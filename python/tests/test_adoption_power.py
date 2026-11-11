import unittest
from unittest.mock import patch,Mock
import subprocess,signal
from scripts.adoption_power import parse_power,battery_details,runner_command,stop_process_group

class PowerTests(unittest.TestCase):
    def test_attached_ac_can_continue_at_37_percent(self):
        self.assertFalse(parse_power("Now drawing from 'AC Power'\n -InternalBattery-0 37%; AC attached; not charging present: true")['stop'])

    def test_low_battery_stops_even_with_ac_attached(self):
        self.assertTrue(parse_power("Now drawing from 'AC Power'\n -InternalBattery-0 15%; AC attached; not charging present: true")['stop'])

    def test_disconnected_low_battery_and_unreadable_state_stop(self):
        self.assertTrue(parse_power("Now drawing from 'Battery Power'\n -InternalBattery-0 20%; discharging")['stop'])
        self.assertTrue(parse_power('unreadable')['stop'])

    def test_battery_draw_and_unsigned_current_are_converted_without_serials(self):
        battery={'Voltage':10875,'Amperage':-5994,'AdapterDetails':{'Watts':17,'SerialString':'private'}}
        self.assertAlmostEqual(battery_details(battery)['batteryWatts'],65.18475)
        self.assertNotIn('private',str(battery_details(battery)))
        battery['Amperage']=2**64-5994
        self.assertAlmostEqual(battery_details(battery)['batteryWatts'],65.18475)
        battery['Amperage']=1000
        self.assertLess(battery_details(battery)['batteryWatts'],0)
        with self.assertRaises(ValueError):battery_details({'Voltage':10875})
        for malformed in [None,[],{'Voltage':10875,'Amperage':1,'AdapterDetails':[]}]:
            with self.assertRaises(ValueError):battery_details(malformed)

    def test_qos_changes_only_the_command_wrapper(self):
        run={'protocol':'p.json','out':'out'}
        plain=runner_command(run,1,'normal')
        self.assertEqual(runner_command(run,4,'background')[:3],['/usr/sbin/taskpolicy','-c','background'])
        self.assertEqual(runner_command(run,1,'background')[3:],plain)
        with self.assertRaises(ValueError):runner_command(run,1,'invalid')
        with patch('scripts.adoption_power.shutil.which',return_value=None):
            with self.assertRaises(FileNotFoundError):runner_command(run,1,'background')

    def test_shutdown_escalates_and_reaps_an_unresponsive_runner_group(self):
        process=Mock(pid=12345);process.wait.side_effect=[subprocess.TimeoutExpired('runner',5),0]
        with patch('scripts.adoption_power.os.killpg') as kill:
            stop_process_group(process)
        self.assertEqual(kill.call_args_list[0].args,(12345,signal.SIGTERM))
        self.assertIn(((12345,signal.SIGKILL),),kill.call_args_list)
        self.assertEqual(process.wait.call_count,2)

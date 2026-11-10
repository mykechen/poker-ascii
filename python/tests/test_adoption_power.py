import unittest
from scripts.adoption_power import parse_power

class PowerTests(unittest.TestCase):
    def test_attached_ac_can_continue_at_37_percent(self):
        self.assertFalse(parse_power("Now drawing from 'AC Power'\n -InternalBattery-0 37%; AC attached; not charging present: true")['stop'])

    def test_low_battery_stops_even_with_ac_attached(self):
        self.assertTrue(parse_power("Now drawing from 'AC Power'\n -InternalBattery-0 15%; AC attached; not charging present: true")['stop'])

    def test_disconnected_low_battery_and_unreadable_state_stop(self):
        self.assertTrue(parse_power("Now drawing from 'Battery Power'\n -InternalBattery-0 20%; discharging")['stop'])
        self.assertTrue(parse_power('unreadable')['stop'])

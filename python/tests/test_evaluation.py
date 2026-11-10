import unittest
from python.evaluation.power import required_units, design_rows
class PowerTests(unittest.TestCase):
 def test_scaling(self):
  self.assertEqual(required_units(1,5,3),4188)
  self.assertLess(required_units(1,10,3),required_units(1,5,3))
 def test_reject_nonfinite(self):
  for variance in [float('nan'),-1,0]:
   with self.assertRaises(ValueError): required_units(variance,5,3)
 def test_identical_pair_variance_zero(self):
  rows=[{'seed':i,'cell':'c','players':6,'rotation':r,'hand':1,'arm':arm,'rawBb':float(i+r),'adjustedBb':float(i+r)} for i in range(1,4) for r in range(6) for arm in ['50','128']]
  d=design_rows(rows,'rawBb')
  self.assertEqual(d['paired']['variance'],0)
  self.assertEqual(d['rotated']['variance'],0)
if __name__=='__main__':unittest.main()

class QuantileTests(unittest.TestCase):
 def test_student_reference(self):
  from python.evaluation.power import t_quantile
  self.assertAlmostEqual(t_quantile(.975,9),2.2621571628,places=9)
  self.assertAlmostEqual(t_quantile(.975,19),2.0930240544,places=9)
 def test_chi_square_reference(self):
  from python.evaluation.power import chi_square_quantile
  self.assertAlmostEqual(chi_square_quantile(.05,9),3.3251128431,places=8)

class ManifestTests(unittest.TestCase):
 def test_every_cluster_in_exactly_one_bounded_run(self):
  from python.evaluation.manifest import partition_clusters
  r=partition_clusters(list(range(101,111)),100,200)
  self.assertEqual([s for x in r for s in x['seeds']],list(range(101,111)))
  self.assertTrue(all(x['predictedSeconds']<=5400 for x in r))
 def test_reject_unfittable_cluster(self):
  from python.evaluation.manifest import partition_clusters
  with self.assertRaises(ValueError):partition_clusters([1],1000,1)

class InputIntegrityTests(unittest.TestCase):
 def test_foreign_paired_cells_are_rejected(self):
  import json,tempfile
  from pathlib import Path
  from python.evaluation.analyze import load
  source=Path('handoffs/evaluation-2026-11-09-r2/unbiased')
  with tempfile.TemporaryDirectory() as directory:
   p=Path(directory)
   for name in ['protocol.json','provenance.json','source.json']:(p/name).write_bytes((source/name).read_bytes())
   rows=[json.loads(x) for x in (source/'hands.jsonl').read_text().splitlines()]
   for r in rows:
    if r['seed']==107001:r['seed']=999999;r['id']=r['id'].replace('107001','999999')
   (p/'hands.jsonl').write_text('\n'.join(json.dumps(r) for r in rows)+'\n')
   with self.assertRaises(ValueError):load(directory)
 def test_valid_archived_run_passes_all_identity_hash_checks(self):
  from python.evaluation.analyze import load
  self.assertEqual(len(load('handoffs/evaluation-2026-11-09-r2/unbiased')),960)

class RotationDesignTests(unittest.TestCase):
 def test_preassigned_rotations_balance_positions_jointly_with_five_lineup_offsets(self):
  from python.evaluation.power import design_rotation
  from collections import Counter
  for players in [6,7,8]:
   counts=Counter((i%5,design_rotation(i,'heuristic',players)) for i in range(840))
   self.assertEqual(len(counts),5*players)
   self.assertEqual(len(set(counts.values())),1)

class ClaimThresholdTests(unittest.TestCase):
 def test_at_least_five_uses_effect_above_five_not_effect_above_zero(self):
  from python.evaluation.confirmatory import budget_scenario
  detect=budget_scenario(1,5,10000,84)
  establish=budget_scenario(1,10,10000,84,threshold=5)
  self.assertEqual(detect['requiredSeedClusters'],establish['requiredSeedClusters'])
  with self.assertRaises(ValueError):budget_scenario(1,5,10000,84,threshold=5)
 def test_three_arm_cost_counts_all_three_once(self):
  from python.evaluation.confirmatory import budget_scenario
  pair=budget_scenario(1,10,10000,84)
  three=budget_scenario(1,10,10000,84,arms=3)
  self.assertEqual(three['totalPhysicalHands'],pair['totalPhysicalHands']*1.5)

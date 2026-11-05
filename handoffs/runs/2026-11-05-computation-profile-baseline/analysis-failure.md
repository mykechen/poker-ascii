# Clock-origin mismatch retained

Measurement runs completed: all warm-up and measured action/payout hashes match. Unprofiled times were 19.625/19.701/19.675 seconds; profiled 20.535 seconds.

The initial analyzer rejected CPU sample filtering: V8 timestamps were 555619884667–555661845001 microseconds, whereas the measured hrtime window was 942809274929–942829809973. They have different origins on this machine. No absolute timestamp alignment or filtered CPU attribution is claimed for this run.

Raw CPU profile is preserved losslessly as .cpuprofile.gz (decompress before use), with raw matches and process time logs. The next run adds a named measured-workload stack marker; its V8 first/last samples bound the measurement window, including intervening GC, and require 95–105% coverage of measured duration. Preserve this failed analysis rather than silently realigning clocks.

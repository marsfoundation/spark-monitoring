compile-health-checker:
	cd lib/sparklend-health-checker && forge b
	mv lib/sparklend-health-checker/out/SparkLendHealthChecker.sol/SparkLendHealthChecker.json actions/jsons/SparkLendHealthChecker.json

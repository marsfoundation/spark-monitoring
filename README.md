# sparklend-monitoring
## Overview
This repo contains a set of Tenderly Web3 actions that are used to monitor contracts in the Spark ecosystem. Monitoring is used for informational alerts as well as critical alerts. Slack webhooks are used to send messages to the team Slack channel. PagerDuty is used for critical alerts, notifying the team of a potential critical incident.

## Summary of Tenderly Monitoring Actions

| Monitor                           | Trigger(s) and Config                                                                                                | Logic |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----- |
| `cleanTransactionRegistry`        | Runs every 100 blocks.<br><br>Active on mainnet and Gnosis.                                                          |       |
| `getAllReservesAssetLiability`    | Runs every 5 blocks.<br><br>Active on mainnet for SparkLend and AAVE.                                                |       |
| `getAssetPriceDeviance`           | Runs every 10 blocks.<br><br>Active on mainnet for SparkLend oracle.                                                 |       |
| `getCapAutomatorUpdate`           | Runs on alerts (TODO).<br><br>Active on mainnet.                                                                     |       |
| `getConfigurationChangeAave`      | Runs on alerts (TODO).<br><br>Active on mainnet.                                                                     |       |
| `getCurrentAggregators`           | Runs on alerts (TODO).<br><br>Active on mainnet.                                                                     |       |
| `getDSRAuthOracleRefresh`         | Runs on `SetPotData` event emission on domain receivers for DSROracle.<br><br>Active on Arbitrum, Base and Optimism. |       |
| `getExecOnSparkProxy`             | Runs on alerts (TODO).<br><br>Active on mainnet (true?)                                                              |       |
| `getGnosisExecutorOperations`     | Runs on alerts (TODO).<br><br>Active on Gnosis (true?)                                                               |       |
| `getHighGasTransaction`           | Runs on alerts (TODO).<br><br>Active on mainnet.                                                                     |       |
| `getKillSwitchOracleTrigger`      | Runs on alerts (TODO).<br><br>Active on mainnet.                                                                     |       |
| `getKillSwitchOraclesState`       | Runs every 5 blocks.<br><br>Active on mainnet.                                                                       |       |
| `getLiftOnDSChief`                | Runs on alerts (TODO).<br><br>Active on mainnet.                                                                     |       |
| `getLiquidationSparkLend`         | Runs on alerts (TODO).<br><br>Active on mainnet and Gnosis.                                                          |       |
| `getMetaMorphoCapChange`          | Runs on alerts (TODO).<br><br>Active on mainnet.                                                                     |       |
| `getPotDsrDataSync`               | Runs every 5 blocks.<br><br>Active on mainnet (true?)                                                                |       |
| `getProtocolInteractionSparkLend` | Runs on alerts (TODO).<br><br>Active on mainnet and Gnosis.                                                          |       |
| `getSparklendArtChange`           | Runs on alert (TODO).<br><br>Active on mainnet.                                                                      |       |
| `getSpellsReadyToExecute`         | Runs every 5 blocks.<br><br>Active on Gnosis.                                                                        |       |
| `getUserInfo`                     | Runs on alerts (TODO).<br><br>Active on mainnet for SparkLend and AAVE.                                              |       |


***
*The IP in this repository was assigned to Mars SPC Limited in respect of the MarsOne SP*


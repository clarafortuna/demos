/* ==========================================================================
   data_ingestion_page.js — Multi-year, multi-table editor
   Storage: localStorage `coned_dac_ingestion_rows_v8`
   Currently supports Sections A, B, C with editable inline rows.
   D-J coming next.
   ========================================================================== */

(function () {
  'use strict';

  const SEED_DATA = {"A":[{"year":"2024","segment":"DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"","incentive_dollars":71602722.0,"energy_savings_mmbtu":439980.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"","incentive_dollars":5955328.0,"energy_savings_mmbtu":43072.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Clean Heat – Commercial & Industrial Air Source Heat Pump","measure":"","incentive_dollars":3436916.0,"energy_savings_mmbtu":10598.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Clean Heat – Commercial & Industrial Air Source Heat Pump","measure":"","incentive_dollars":10796590.0,"energy_savings_mmbtu":50711.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Clean Heat – Commercial & Industrial Ground Source Heat Pump","measure":"","incentive_dollars":0.0,"energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Clean Heat – Commercial & Industrial Ground Source Heat Pump","measure":"","incentive_dollars":1526891.0,"energy_savings_mmbtu":3717.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"","incentive_dollars":655300.0,"energy_savings_mmbtu":3728.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"","incentive_dollars":1134799.0,"energy_savings_mmbtu":3957.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Clean Heat – Multifamily Air Source Heat Pump","measure":"","incentive_dollars":27928074.0,"energy_savings_mmbtu":99387.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Clean Heat – Multifamily Air Source Heat Pump","measure":"","incentive_dollars":14735552.0,"energy_savings_mmbtu":56346.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Clean Heat – Multifamily Ground Source Heat Pump","measure":"","incentive_dollars":6579092.0,"energy_savings_mmbtu":24886.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Clean Heat – Multifamily Ground Source Heat Pump","measure":"","incentive_dollars":114661.0,"energy_savings_mmbtu":249.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Clean Heat – Residential Air Source Heat Pump","measure":"","incentive_dollars":45204005.0,"energy_savings_mmbtu":240396.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Clean Heat – Residential Air Source Heat Pump","measure":"","incentive_dollars":49716737.0,"energy_savings_mmbtu":323179.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Clean Heat – Residential Ground Source Heat Pump","measure":"","incentive_dollars":547990.0,"energy_savings_mmbtu":1080.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Clean Heat – Residential Ground Source Heat Pump","measure":"","incentive_dollars":4907388.0,"energy_savings_mmbtu":12537.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Clean Heat – Small-Medium Business Air Source Heat Pump","measure":"","incentive_dollars":3285890.0,"energy_savings_mmbtu":16139.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Clean Heat – Small-Medium Business Air Source Heat Pump","measure":"","incentive_dollars":7135455.0,"energy_savings_mmbtu":25131.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Commercial & Industrial","measure":"","incentive_dollars":8885679.0,"energy_savings_mmbtu":96256.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Commercial & Industrial","measure":"","incentive_dollars":42394840.0,"energy_savings_mmbtu":234737.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Commercial Kitchen","measure":"","incentive_dollars":216700.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Commercial Kitchen","measure":"","incentive_dollars":257900.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Efficiency Starter Program - LMI","measure":"","incentive_dollars":84015.0,"energy_savings_mmbtu":8324.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Efficiency Starter Program - LMI","measure":"","incentive_dollars":0.0,"energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"EmPower+","measure":"","incentive_dollars":1409607.0,"energy_savings_mmbtu":4342.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"EmPower+","measure":"","incentive_dollars":0.0,"energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Instant Lighting","measure":"","incentive_dollars":1718406.0,"energy_savings_mmbtu":28446.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Instant Lighting","measure":"","incentive_dollars":2754717.0,"energy_savings_mmbtu":50846.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Marketplace","measure":"","incentive_dollars":17900.0,"energy_savings_mmbtu":357.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Marketplace","measure":"","incentive_dollars":35944.0,"energy_savings_mmbtu":641.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Midstream Water and Space Heating","measure":"","incentive_dollars":1206857.0,"energy_savings_mmbtu":14473.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Midstream Water and Space Heating","measure":"","incentive_dollars":264484.0,"energy_savings_mmbtu":11466.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Multifamily","measure":"","incentive_dollars":15476005.0,"energy_savings_mmbtu":105777.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Multifamily","measure":"","incentive_dollars":19081136.0,"energy_savings_mmbtu":186590.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Multifamily - Fuel-Switch","measure":"","incentive_dollars":39643.0,"energy_savings_mmbtu":1043.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Multifamily - Fuel-Switch","measure":"","incentive_dollars":878051.0,"energy_savings_mmbtu":15641.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Commercial Water Heaters PEI (Pump Energy Index)","measure":"","incentive_dollars":704.0,"energy_savings_mmbtu":23.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Commercial Water Heaters PEI (Pump Energy Index)","measure":"","incentive_dollars":8280.0,"energy_savings_mmbtu":569.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Pilots","measure":"","incentive_dollars":47296.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Pilots","measure":"","incentive_dollars":80928.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Real Time Energy Management","measure":"","incentive_dollars":105798.0,"energy_savings_mmbtu":1031.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Real Time Energy Management","measure":"","incentive_dollars":80365.0,"energy_savings_mmbtu":784.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Retail Lighting","measure":"","incentive_dollars":-434114.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Retail Lighting","measure":"","incentive_dollars":-135620.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Retail Lighting - LMI","measure":"","incentive_dollars":1009602.0,"energy_savings_mmbtu":31263.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Retail Lighting - LMI","measure":"","incentive_dollars":0.0,"energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Retail Products","measure":"","incentive_dollars":5117078.0,"energy_savings_mmbtu":1107423.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Retail Products","measure":"","incentive_dollars":2957614.0,"energy_savings_mmbtu":587961.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Small-Medium Business","measure":"","incentive_dollars":9180221.0,"energy_savings_mmbtu":94989.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Small-Medium Business","measure":"","incentive_dollars":8494678.0,"energy_savings_mmbtu":85060.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Smart Kids","measure":"","incentive_dollars":845316.0,"energy_savings_mmbtu":27604.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Smart Kids","measure":"","incentive_dollars":17320.0,"energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Weather Ready","measure":"","incentive_dollars":618886.0,"energy_savings_mmbtu":2303.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Weather Ready","measure":"","incentive_dollars":2286087.0,"energy_savings_mmbtu":9311.0,"participants":"","installations":""},{"year":"2024","segment":"DAC","program":"Residential Home Energy Reports","measure":"","incentive_dollars":"","energy_savings_mmbtu":127114.0,"participants":"","installations":""},{"year":"2024","segment":"Non-DAC","program":"Residential Home Energy Reports","measure":"","incentive_dollars":"","energy_savings_mmbtu":171412.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"AMEEP - Electric & Gas","measure":"","incentive_dollars":31612418.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"AMEEP - Electric & Gas","measure":"","incentive_dollars":2283319.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Clean Heat – C&I ASHP","measure":"","incentive_dollars":2940949.0,"energy_savings_mmbtu":26941.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Clean Heat – C&I ASHP","measure":"","incentive_dollars":3838841.0,"energy_savings_mmbtu":20276.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Clean Heat – C&I GSHP","measure":"","incentive_dollars":0.0,"energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Clean Heat – C&I GSHP","measure":"","incentive_dollars":2698732.0,"energy_savings_mmbtu":6747.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Clean Heat – Multifamily ASHP","measure":"","incentive_dollars":20952100.0,"energy_savings_mmbtu":123384.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Clean Heat – Multifamily ASHP","measure":"","incentive_dollars":7336802.0,"energy_savings_mmbtu":57965.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Clean Heat – Multifamily GSHP","measure":"","incentive_dollars":1296000.0,"energy_savings_mmbtu":5648.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Clean Heat – Multifamily GSHP","measure":"","incentive_dollars":0.0,"energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Clean Heat – Residential ASHP","measure":"","incentive_dollars":34121994.0,"energy_savings_mmbtu":134186.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Clean Heat – Residential ASHP","measure":"","incentive_dollars":44568622.0,"energy_savings_mmbtu":208204.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Clean Heat – Residential GSHP","measure":"","incentive_dollars":727485.0,"energy_savings_mmbtu":1822.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Clean Heat – Residential GSHP","measure":"","incentive_dollars":7910786.0,"energy_savings_mmbtu":19656.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Clean Heat – SMB ASHP","measure":"","incentive_dollars":3989082.0,"energy_savings_mmbtu":18955.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Clean Heat – SMB ASHP","measure":"","incentive_dollars":5953542.0,"energy_savings_mmbtu":39890.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"C&I Program – Electric & Gas","measure":"","incentive_dollars":9110325.0,"energy_savings_mmbtu":122099.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"C&I Program – Electric & Gas","measure":"","incentive_dollars":24015451.0,"energy_savings_mmbtu":657289.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Commercial Kitchen","measure":"","incentive_dollars":793662.0,"energy_savings_mmbtu":12935.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Commercial Kitchen","measure":"","incentive_dollars":909211.0,"energy_savings_mmbtu":22438.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Efficiency Starter Program - LMI","measure":"","incentive_dollars":65587.0,"energy_savings_mmbtu":3870.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Efficiency Starter Program - LMI","measure":"","incentive_dollars":0.0,"energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Instant Lighting","measure":"","incentive_dollars":503000.0,"energy_savings_mmbtu":15324.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Instant Lighting","measure":"","incentive_dollars":2320408.0,"energy_savings_mmbtu":72622.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Marketplace – Electric & Gas","measure":"","incentive_dollars":245178.0,"energy_savings_mmbtu":6474.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Marketplace – Electric & Gas","measure":"","incentive_dollars":485463.0,"energy_savings_mmbtu":13588.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Multifamily Program – Electric & Gas","measure":"","incentive_dollars":8565740.0,"energy_savings_mmbtu":73073.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Multifamily Program – Electric & Gas","measure":"","incentive_dollars":12443950.0,"energy_savings_mmbtu":131715.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Pilots","measure":"","incentive_dollars":57076.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Pilots","measure":"","incentive_dollars":106212.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Residential Weatherization – Electric & Gas","measure":"","incentive_dollars":283948.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Residential Weatherization – Electric & Gas","measure":"","incentive_dollars":1978764.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Retail Lighting","measure":"","incentive_dollars":2483635.0,"energy_savings_mmbtu":194269.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Retail Lighting","measure":"","incentive_dollars":1973415.0,"energy_savings_mmbtu":167044.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Retail Lighting - LMI","measure":"","incentive_dollars":280147.0,"energy_savings_mmbtu":61167.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Retail Lighting - LMI","measure":"","incentive_dollars":0.0,"energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Retail Products – Electric & Gas","measure":"","incentive_dollars":589636.0,"energy_savings_mmbtu":209487.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Retail Products – Electric & Gas","measure":"","incentive_dollars":463047.0,"energy_savings_mmbtu":168086.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"SMB Program","measure":"","incentive_dollars":9441467.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"SMB Program","measure":"","incentive_dollars":12671526.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Smart Kids – Electric & Gas","measure":"","incentive_dollars":466118.0,"energy_savings_mmbtu":9564.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Smart Kids – Electric & Gas","measure":"","incentive_dollars":413539.0,"energy_savings_mmbtu":7878.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Smart Kids LMI – Electric & Gas","measure":"","incentive_dollars":669504.0,"energy_savings_mmbtu":26852.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Smart Kids LMI – Electric & Gas","measure":"","incentive_dollars":0.0,"energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Midstream Water and Space Heating","measure":"","incentive_dollars":484759.0,"energy_savings_mmbtu":18615.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Midstream Water and Space Heating","measure":"","incentive_dollars":454380.0,"energy_savings_mmbtu":23751.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Residential Program – Gas","measure":"","incentive_dollars":425.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Residential Program – Gas","measure":"","incentive_dollars":18675.0,"energy_savings_mmbtu":"","participants":"","installations":""},{"year":"2023","segment":"DAC","program":"AMEEP – Electric & Gas","measure":"","incentive_dollars":"","energy_savings_mmbtu":329992.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"AMEEP – Electric & Gas","measure":"","incentive_dollars":"","energy_savings_mmbtu":41551.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"","incentive_dollars":"","energy_savings_mmbtu":161.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"","incentive_dollars":"","energy_savings_mmbtu":8953.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"EmPower – Electric & Gas","measure":"","incentive_dollars":"","energy_savings_mmbtu":4464.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"EmPower – Electric & Gas","measure":"","incentive_dollars":"","energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Multifamily - Fuel-Switch","measure":"","incentive_dollars":"","energy_savings_mmbtu":22075.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Multifamily - Fuel-Switch","measure":"","incentive_dollars":"","energy_savings_mmbtu":38416.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Real Time Energy Management","measure":"","incentive_dollars":"","energy_savings_mmbtu":397.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Real Time Energy Management","measure":"","incentive_dollars":"","energy_savings_mmbtu":0.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Residential Home Energy Reports – Electric & Gas","measure":"","incentive_dollars":"","energy_savings_mmbtu":124344.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Residential Home Energy Reports – Electric & Gas","measure":"","incentive_dollars":"","energy_savings_mmbtu":177350.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Residential Weatherization","measure":"","incentive_dollars":"","energy_savings_mmbtu":3977.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Residential Weatherization","measure":"","incentive_dollars":"","energy_savings_mmbtu":23934.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"SMB Program – Electric & Gas","measure":"","incentive_dollars":"","energy_savings_mmbtu":109174.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"SMB Program – Electric & Gas","measure":"","incentive_dollars":"","energy_savings_mmbtu":149602.0,"participants":"","installations":""},{"year":"2023","segment":"DAC","program":"Virtual Commissioning","measure":"","incentive_dollars":"","energy_savings_mmbtu":653.0,"participants":"","installations":""},{"year":"2023","segment":"Non-DAC","program":"Virtual Commissioning","measure":"","incentive_dollars":"","energy_savings_mmbtu":1242.0,"participants":"","installations":""},{"year":"2024","segment":"Residential","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"","participants":538,"incentive_dollars":1789926,"energy_savings_mmbtu":7532,"installations":""},{"year":"2024","segment":"Residential","program":"Clean Heat – Residential Air Source Heat Pump","measure":"","participants":12813,"incentive_dollars":94918704,"energy_savings_mmbtu":563772,"installations":""},{"year":"2024","segment":"Residential","program":"Clean Heat – Residential Ground Source Heat Pump","measure":"","participants":145,"incentive_dollars":5455335,"energy_savings_mmbtu":13630,"installations":""},{"year":"2024","segment":"Residential","program":"Efficiency Starter Program - LMI","measure":"","participants":12893,"incentive_dollars":90251,"energy_savings_mmbtu":12893,"installations":""},{"year":"2024","segment":"Residential","program":"EmPower+","measure":"","participants":582,"incentive_dollars":1409604,"energy_savings_mmbtu":4074,"installations":""},{"year":"2024","segment":"Residential","program":"Marketplace","measure":"","participants":1389,"incentive_dollars":54171,"energy_savings_mmbtu":1389,"installations":""},{"year":"2024","segment":"Residential","program":"Residential Home Energy Reports","measure":"","participants":1237910,"incentive_dollars":"","energy_savings_mmbtu":297098.4,"installations":""},{"year":"2024","segment":"Residential","program":"Retail Lighting - LMI","measure":"","participants":78408,"incentive_dollars":1019304,"energy_savings_mmbtu":31363.2,"installations":""},{"year":"2024","segment":"Residential","program":"Retail Products","measure":"","participants":514639,"incentive_dollars":8234224,"energy_savings_mmbtu":1543917,"installations":""},{"year":"2024","segment":"Residential","program":"Smart Kids","measure":"","participants":70910,"incentive_dollars":850920,"energy_savings_mmbtu":27654.9,"installations":""},{"year":"2024","segment":"Residential","program":"Weather Ready","measure":"","participants":1348,"incentive_dollars":2904940,"energy_savings_mmbtu":12132,"installations":""},{"year":"2024","segment":"Multisector","program":"Pilots","measure":"","participants":20,"incentive_dollars":128220,"energy_savings_mmbtu":0,"installations":""},{"year":"2024","segment":"Multisector","program":"Real Time Energy Management","measure":"","participants":6,"incentive_dollars":186162,"energy_savings_mmbtu":1812,"installations":""},{"year":"2024","segment":"Multifamily","program":"Affordable Multifamily Energy Efficiency Program","measure":"","participants":151045,"incentive_dollars":77486085,"energy_savings_mmbtu":453135,"installations":""},{"year":"2024","segment":"Multifamily","program":"Clean Heat – Multifamily Air Source Heat Pump","measure":"","participants":240,"incentive_dollars":42663600,"energy_savings_mmbtu":155760,"installations":""},{"year":"2024","segment":"Multifamily","program":"Clean Heat – Multifamily Ground Source Heat Pump","measure":"","participants":5,"incentive_dollars":6693755,"energy_savings_mmbtu":25135,"installations":""},{"year":"2024","segment":"Multifamily","program":"Multifamily","measure":"","participants":1275,"incentive_dollars":34557600,"energy_savings_mmbtu":291975,"installations":""},{"year":"2024","segment":"Multifamily","program":"Multifamily - Fuel-Switch","measure":"","participants":9,"incentive_dollars":917.64,"energy_savings_mmbtu":16686,"installations":""},{"year":"2024","segment":"Commercial","program":"Clean Heat – Commercial & Industrial Air Source Heat Pump","measure":"","participants":34,"incentive_dollars":14233522,"energy_savings_mmbtu":61302,"installations":""},{"year":"2024","segment":"Commercial","program":"Clean Heat – Commercial & Industrial Ground Source Heat Pump","measure":"","participants":1,"incentive_dollars":1526891,"energy_savings_mmbtu":3717,"installations":""},{"year":"2024","segment":"Commercial","program":"Clean Heat – Small-Medium Business Air Source Heat Pump","measure":"","participants":217,"incentive_dollars":10420.34,"energy_savings_mmbtu":41230,"installations":""},{"year":"2024","segment":"Commercial","program":"Commercial & Industrial","measure":"","participants":315,"incentive_dollars":51321375,"energy_savings_mmbtu":331380,"installations":""},{"year":"2024","segment":"Commercial","program":"Commercial Water Heaters PEI (Pump Energy Index)","measure":"","participants":12,"incentive_dollars":8988,"energy_savings_mmbtu":588,"installations":""},{"year":"2024","segment":"Commercial","program":"Instant Lighting","measure":"","participants":569,"incentive_dollars":4472909,"energy_savings_mmbtu":79091,"installations":""},{"year":"2024","segment":"Commercial","program":"Midstream Water and Space Heating","measure":"","participants":367,"incentive_dollars":1471303,"energy_savings_mmbtu":26057,"installations":""},{"year":"2024","segment":"Commercial","program":"Small-Medium Business","measure":"","participants":1998,"incentive_dollars":17674308,"energy_savings_mmbtu":179820,"installations":""},{"year":"2023","segment":"Residential","program":"Clean Heat – Residential ASHP","measure":"","participants":4838,"incentive_dollars":78690070,"energy_savings_mmbtu":343498,"installations":""},{"year":"2023","segment":"Residential","program":"Clean Heat – Residential GSHP","measure":"","participants":199,"incentive_dollars":8638192,"energy_savings_mmbtu":21492,"installations":""},{"year":"2023","segment":"Residential","program":"Efficiency Starter Program – LMI Electric & Gas","measure":"","participants":7464,"incentive_dollars":67176,"energy_savings_mmbtu":7464,"installations":""},{"year":"2023","segment":"Residential","program":"EmPower – Electric & Gas","measure":"","participants":545,"incentive_dollars":0,"energy_savings_mmbtu":4360,"installations":""},{"year":"2023","segment":"Residential","program":"Marketplace Electric & Gas","measure":"","participants":25526,"incentive_dollars":740254,"energy_savings_mmbtu":25526,"installations":""},{"year":"2023","segment":"Residential","program":"Residential Home Energy Reports","measure":"","participants":1374518,"incentive_dollars":0,"energy_savings_mmbtu":302393.96,"installations":""},{"year":"2023","segment":"Residential","program":"Residential Weatherization – Electric & Gas","measure":"","participants":1194,"incentive_dollars":2262630,"energy_savings_mmbtu":27462,"installations":""},{"year":"2023","segment":"Residential","program":"Retail Lighting","measure":"","participants":494550,"incentive_dollars":4450950,"energy_savings_mmbtu":494550,"installations":""},{"year":"2023","segment":"Residential","program":"Retail Lighting LMI","measure":"","participants":153408,"incentive_dollars":306816,"energy_savings_mmbtu":61363.2,"installations":""},{"year":"2023","segment":"Residential","program":"Retail Products – Electric & Gas","measure":"","participants":61890,"incentive_dollars":1052130,"energy_savings_mmbtu":371340,"installations":""},{"year":"2023","segment":"Residential","program":"Smart Kids – Electric & Gas","measure":"","participants":61476,"incentive_dollars":860664,"energy_savings_mmbtu":18442.8,"installations":""},{"year":"2023","segment":"Residential","program":"Smart Kids LMI – Electric & Gas","measure":"","participants":59820,"incentive_dollars":658020,"energy_savings_mmbtu":23928.0,"installations":""},{"year":"2023","segment":"Multifamily","program":"AMEEP – Electric & Gas","measure":"","participants":85455,"incentive_dollars":33925635,"energy_savings_mmbtu":341820,"installations":""},{"year":"2023","segment":"Multifamily","program":"Clean Heat – Multifamily ASHP","measure":"","participants":202,"incentive_dollars":28288888,"energy_savings_mmbtu":181396,"installations":""},{"year":"2023","segment":"Multifamily","program":"Clean Heat – Multifamily GSHP","measure":"","participants":1,"incentive_dollars":1296000,"energy_savings_mmbtu":5648,"installations":""},{"year":"2023","segment":"Multifamily","program":"Multifamily Program – Electric & Gas","measure":"","participants":2227,"incentive_dollars":21009518,"energy_savings_mmbtu":204884,"installations":""},{"year":"2023","segment":"Multifamily","program":"Multifamily - Fuel-Switch","measure":"","participants":5,"incentive_dollars":0,"energy_savings_mmbtu":60490,"installations":""},{"year":"2023","segment":"Commercial","program":"Clean Heat – C&I ASHP","measure":"","participants":43,"incentive_dollars":6779810,"energy_savings_mmbtu":47214,"installations":""},{"year":"2023","segment":"Commercial","program":"Clean Heat – C&I GSHP","measure":"","participants":1,"incentive_dollars":2698732,"energy_savings_mmbtu":6747,"installations":""},{"year":"2023","segment":"Commercial","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"","participants":157,"incentive_dollars":0,"energy_savings_mmbtu":9106,"installations":""},{"year":"2023","segment":"Commercial","program":"Clean Heat – SMB ASHP","measure":"","participants":131,"incentive_dollars":9942638,"energy_savings_mmbtu":58819,"installations":""},{"year":"2023","segment":"Commercial","program":"C&I Program – Electric & Gas","measure":"","participants":571,"incentive_dollars":33125994,"energy_savings_mmbtu":779415,"installations":""},{"year":"2023","segment":"Commercial","program":"Commercial Kitchen","measure":"","participants":953,"incentive_dollars":1703011,"energy_savings_mmbtu":35261,"installations":""},{"year":"2023","segment":"Commercial","program":"Instant Lighting","measure":"","participants":577,"incentive_dollars":2823261,"energy_savings_mmbtu":87704,"installations":""},{"year":"2023","segment":"Commercial","program":"Midstream Water and Space Heating","measure":"","participants":302,"incentive_dollars":939220,"energy_savings_mmbtu":42280,"installations":""},{"year":"2023","segment":"Commercial","program":"Pilots","measure":"","participants":0,"incentive_dollars":"","energy_savings_mmbtu":"","installations":""},{"year":"2023","segment":"Commercial","program":"Real Time Energy Management","measure":"","participants":1,"incentive_dollars":0,"energy_savings_mmbtu":397,"installations":""},{"year":"2023","segment":"Commercial","program":"SMB Program – Electric & Gas","measure":"","participants":2906,"incentive_dollars":22111754,"energy_savings_mmbtu":258634,"installations":""},{"year":"2023","segment":"Commercial","program":"Virtual Commissioning","measure":"","participants":8,"incentive_dollars":0,"energy_savings_mmbtu":1896,"installations":""},{"year":"2024","segment":"Commercial / DAC","program":"Clean Heat – Commercial & Industrial Air Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4},{"year":"2024","segment":"Commercial / Non-DAC","program":"Clean Heat – Commercial & Industrial Air Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":41},{"year":"2024","segment":"Commercial / DAC","program":"Clean Heat – Commercial & Industrial Ground Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Commercial / Non-DAC","program":"Clean Heat – Commercial & Industrial Ground Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2024","segment":"Commercial / DAC","program":"Clean Heat – Small-Medium Business Air Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":201},{"year":"2024","segment":"Commercial / Non-DAC","program":"Clean Heat – Small-Medium Business Air Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":257},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"Appliances","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"Appliances","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":21},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":59},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"Compressed Air","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"Compressed Air","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":7},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":17},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":42},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":21},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":43},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":13},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":42},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"Lighting - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":5},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"Lighting - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":6},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":13},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":43},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"Process Equipment","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":7},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"Process Equipment","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":19},{"year":"2024","segment":"Commercial / DAC","program":"Commercial & Industrial","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial & Industrial","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2024","segment":"Commercial / DAC","program":"Commercial Water Heaters PEI","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2024","segment":"Commercial / Non-DAC","program":"Commercial Water Heaters PEI","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":17},{"year":"2024","segment":"Commercial / DAC","program":"Instant Lighting","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":473},{"year":"2024","segment":"Commercial / Non-DAC","program":"Instant Lighting","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1076},{"year":"2024","segment":"Commercial / DAC","program":"Midstream Water and Space Heating","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":92},{"year":"2024","segment":"Commercial / Non-DAC","program":"Midstream Water and Space Heating","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":118},{"year":"2024","segment":"Commercial / DAC","program":"Midstream Water and Space Heating","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":64},{"year":"2024","segment":"Commercial / Non-DAC","program":"Midstream Water and Space Heating","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":46},{"year":"2024","segment":"Commercial / DAC","program":"Small-Medium Business","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":6},{"year":"2024","segment":"Commercial / Non-DAC","program":"Small-Medium Business","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2024","segment":"Commercial / DAC","program":"Small-Medium Business","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Commercial / Non-DAC","program":"Small-Medium Business","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2024","segment":"Commercial / DAC","program":"Small-Medium Business","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":25},{"year":"2024","segment":"Commercial / Non-DAC","program":"Small-Medium Business","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":11},{"year":"2024","segment":"Commercial / DAC","program":"Small-Medium Business","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":28},{"year":"2024","segment":"Commercial / Non-DAC","program":"Small-Medium Business","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":27},{"year":"2024","segment":"Commercial / DAC","program":"Small-Medium Business","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":8760},{"year":"2024","segment":"Commercial / Non-DAC","program":"Small-Medium Business","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":9149},{"year":"2024","segment":"Commercial / DAC","program":"Small-Medium Business","measure":"Lighting - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":67},{"year":"2024","segment":"Commercial / Non-DAC","program":"Small-Medium Business","measure":"Lighting - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":35},{"year":"2024","segment":"Commercial / DAC","program":"Small-Medium Business","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":373},{"year":"2024","segment":"Commercial / Non-DAC","program":"Small-Medium Business","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":352},{"year":"2024","segment":"Commercial / DAC","program":"Small-Medium Business","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":602},{"year":"2024","segment":"Commercial / Non-DAC","program":"Small-Medium Business","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":384},{"year":"2024","segment":"Commercial / DAC","program":"Small-Medium Business","measure":"Refrigeration - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":589},{"year":"2024","segment":"Commercial / Non-DAC","program":"Small-Medium Business","measure":"Refrigeration - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":464},{"year":"2023","segment":"Multisector / DAC","program":"Clean Heat – C&I ASHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":14},{"year":"2023","segment":"Multisector / Non-DAC","program":"Clean Heat – C&I ASHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":29},{"year":"2023","segment":"Multisector / DAC","program":"Clean Heat – C&I ASHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":14},{"year":"2023","segment":"Multisector / Non-DAC","program":"Clean Heat – C&I ASHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":29},{"year":"2023","segment":"Multisector / DAC","program":"Clean Heat – C&I GSHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multisector / Non-DAC","program":"Clean Heat – C&I GSHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multisector / DAC","program":"Clean Heat – C&I GSHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multisector / Non-DAC","program":"Clean Heat – C&I GSHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multisector / DAC","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":17},{"year":"2023","segment":"Multisector / Non-DAC","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":187},{"year":"2023","segment":"Multisector / DAC","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":17},{"year":"2023","segment":"Multisector / Non-DAC","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":187},{"year":"2023","segment":"Multisector / DAC","program":"Clean Heat – Small-Medium Business Air Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":50},{"year":"2023","segment":"Multisector / Non-DAC","program":"Clean Heat – Small-Medium Business Air Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":81},{"year":"2023","segment":"Multisector / DAC","program":"Clean Heat – Small-Medium Business Air Source Heat Pump","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":50},{"year":"2023","segment":"Multisector / Non-DAC","program":"Clean Heat – Small-Medium Business Air Source Heat Pump","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":82},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"Appliance","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"Appliance","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"Appliance Controls","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"Appliance Controls","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":9},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":29},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"Compressed Air","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":11},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"Compressed Air","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":9},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":36},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":67},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":42},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":136},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":46},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":91},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"Lighting Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":24},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"Lighting Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":49},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":11},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":57},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"Process Equipment","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":9},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"Process Equipment","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":19},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":5},{"year":"2023","segment":"Multisector / DAC","program":"Commercial & Industrial","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":193},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial & Industrial","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":464},{"year":"2023","segment":"Multisector / DAC","program":"Commercial Kitchen","measure":"Appliance","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":296},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial Kitchen","measure":"Appliance","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":572},{"year":"2023","segment":"Multisector / DAC","program":"Commercial Kitchen","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial Kitchen","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":7},{"year":"2023","segment":"Multisector / DAC","program":"Commercial Kitchen","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":31},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial Kitchen","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":38},{"year":"2023","segment":"Multisector / DAC","program":"Commercial Kitchen","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":330},{"year":"2023","segment":"Multisector / Non-DAC","program":"Commercial Kitchen","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":617},{"year":"2023","segment":"Multisector / DAC","program":"Instant Lighting","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":398},{"year":"2023","segment":"Multisector / Non-DAC","program":"Instant Lighting","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1213},{"year":"2023","segment":"Multisector / DAC","program":"Instant Lighting","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":398},{"year":"2023","segment":"Multisector / Non-DAC","program":"Instant Lighting","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1213},{"year":"2023","segment":"Multisector / DAC","program":"Real Time Energy Management","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multisector / Non-DAC","program":"Real Time Energy Management","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multisector / DAC","program":"Real Time Energy Management","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multisector / Non-DAC","program":"Real Time Energy Management","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multisector / DAC","program":"SMB Program – Electric & Gas","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":5},{"year":"2023","segment":"Multisector / Non-DAC","program":"SMB Program – Electric & Gas","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":6},{"year":"2023","segment":"Multisector / DAC","program":"SMB Program – Electric & Gas","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":5},{"year":"2023","segment":"Multisector / Non-DAC","program":"SMB Program – Electric & Gas","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":6},{"year":"2023","segment":"Multisector / DAC","program":"SMB Program – Electric & Gas","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":21},{"year":"2023","segment":"Multisector / Non-DAC","program":"SMB Program – Electric & Gas","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":26},{"year":"2023","segment":"Multisector / DAC","program":"SMB Program – Electric & Gas","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":933},{"year":"2023","segment":"Multisector / Non-DAC","program":"SMB Program – Electric & Gas","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":970},{"year":"2023","segment":"Multisector / DAC","program":"SMB Program – Electric & Gas","measure":"Lighting Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":5},{"year":"2023","segment":"Multisector / Non-DAC","program":"SMB Program – Electric & Gas","measure":"Lighting Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":20},{"year":"2023","segment":"Multisector / DAC","program":"SMB Program – Electric & Gas","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":27},{"year":"2023","segment":"Multisector / Non-DAC","program":"SMB Program – Electric & Gas","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":27},{"year":"2023","segment":"Multisector / DAC","program":"SMB Program – Electric & Gas","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":326},{"year":"2023","segment":"Multisector / Non-DAC","program":"SMB Program – Electric & Gas","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":217},{"year":"2023","segment":"Multisector / DAC","program":"SMB Program – Electric & Gas","measure":"Refrigeration Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":221},{"year":"2023","segment":"Multisector / Non-DAC","program":"SMB Program – Electric & Gas","measure":"Refrigeration Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":172},{"year":"2023","segment":"Multisector / DAC","program":"SMB Program – Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1543},{"year":"2023","segment":"Multisector / Non-DAC","program":"SMB Program – Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1444},{"year":"2023","segment":"Multisector / DAC","program":"Virtual Commissioning","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3},{"year":"2023","segment":"Multisector / Non-DAC","program":"Virtual Commissioning","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":5},{"year":"2023","segment":"Multisector / DAC","program":"Virtual Commissioning","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3},{"year":"2023","segment":"Multisector / Non-DAC","program":"Virtual Commissioning","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":5},{"year":"2023","segment":"Multisector / DAC","program":"Virtual Commissioning","measure":"Commercial Programs Total Installations","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2549},{"year":"2023","segment":"Multisector / Non-DAC","program":"Virtual Commissioning","measure":"Commercial Programs Total Installations","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4042},{"year":"2024","segment":"Multifamily / DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Appliances","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Appliances","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Multifamily / DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4156},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":238},{"year":"2024","segment":"Multifamily / DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":971},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":66},{"year":"2024","segment":"Multifamily / DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Domestic Hot Water - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":69},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Domestic Hot Water - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3},{"year":"2024","segment":"Multifamily / DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":105},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":8},{"year":"2024","segment":"Multifamily / DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":199},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":20},{"year":"2024","segment":"Multifamily / DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3950},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1257},{"year":"2024","segment":"Multifamily / DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Lighting - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Lighting - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Multifamily / DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":8},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Affordable Multifamily Energy Efficiency Program","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2024","segment":"Multifamily / DAC","program":"Clean Heat – Multifamily Air Source Heat Pump","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":7},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Clean Heat – Multifamily Air Source Heat Pump","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":5},{"year":"2024","segment":"Multifamily / DAC","program":"Clean Heat – Multifamily Air Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":764},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Clean Heat – Multifamily Air Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":283},{"year":"2024","segment":"Multifamily / DAC","program":"Clean Heat – Multifamily Ground Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":14},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Clean Heat – Multifamily Ground Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2024","segment":"Multifamily / DAC","program":"Multifamily","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":415},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Multifamily","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":332},{"year":"2024","segment":"Multifamily / DAC","program":"Multifamily","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":85},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Multifamily","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":26},{"year":"2024","segment":"Multifamily / DAC","program":"Multifamily","measure":"Domestic Hot Water - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Multifamily","measure":"Domestic Hot Water - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2024","segment":"Multifamily / DAC","program":"Multifamily","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":19},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Multifamily","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":77},{"year":"2024","segment":"Multifamily / DAC","program":"Multifamily","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":140},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Multifamily","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":189},{"year":"2024","segment":"Multifamily / DAC","program":"Multifamily","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":859},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Multifamily","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3594},{"year":"2024","segment":"Multifamily / DAC","program":"Multifamily","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Multifamily","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":38},{"year":"2024","segment":"Multifamily / DAC","program":"Multifamily - Fuel-Switch","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Multifamily - Fuel-Switch","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Multifamily / DAC","program":"Multifamily - Fuel-Switch","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Multifamily - Fuel-Switch","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":8},{"year":"2024","segment":"Multifamily / DAC","program":"Multifamily - Fuel-Switch","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Multifamily / Non-DAC","program":"Multifamily - Fuel-Switch","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multifamily / DAC","program":"AMEEP – Electric & Gas","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":888},{"year":"2023","segment":"Multifamily / Non-DAC","program":"AMEEP – Electric & Gas","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":55},{"year":"2023","segment":"Multifamily / DAC","program":"AMEEP – Electric & Gas","measure":"Domestic Hot Water Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2023","segment":"Multifamily / Non-DAC","program":"AMEEP – Electric & Gas","measure":"Domestic Hot Water Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multifamily / DAC","program":"AMEEP – Electric & Gas","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":83},{"year":"2023","segment":"Multifamily / Non-DAC","program":"AMEEP – Electric & Gas","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":16},{"year":"2023","segment":"Multifamily / DAC","program":"AMEEP – Electric & Gas","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":167},{"year":"2023","segment":"Multifamily / Non-DAC","program":"AMEEP – Electric & Gas","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":22},{"year":"2023","segment":"Multifamily / DAC","program":"AMEEP – Electric & Gas","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":266},{"year":"2023","segment":"Multifamily / Non-DAC","program":"AMEEP – Electric & Gas","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":35},{"year":"2023","segment":"Multifamily / DAC","program":"AMEEP – Electric & Gas","measure":"Lighting Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":21},{"year":"2023","segment":"Multifamily / Non-DAC","program":"AMEEP – Electric & Gas","measure":"Lighting Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3},{"year":"2023","segment":"Multifamily / DAC","program":"AMEEP – Electric & Gas","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2023","segment":"Multifamily / Non-DAC","program":"AMEEP – Electric & Gas","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2023","segment":"Multifamily / DAC","program":"AMEEP – Electric & Gas","measure":"Process Equipment","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multifamily / Non-DAC","program":"AMEEP – Electric & Gas","measure":"Process Equipment","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multifamily / DAC","program":"AMEEP – Electric & Gas","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multifamily / Non-DAC","program":"AMEEP – Electric & Gas","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multifamily / DAC","program":"AMEEP – Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1432},{"year":"2023","segment":"Multifamily / Non-DAC","program":"AMEEP – Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":133},{"year":"2023","segment":"Multifamily / DAC","program":"Clean Heat – Multifamily ASHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":132},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Clean Heat – Multifamily ASHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":70},{"year":"2023","segment":"Multifamily / DAC","program":"Clean Heat – Multifamily ASHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":132},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Clean Heat – Multifamily ASHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":70},{"year":"2023","segment":"Multifamily / DAC","program":"Clean Heat – Multifamily GSHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Clean Heat – Multifamily GSHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multifamily / DAC","program":"Clean Heat – Multifamily GSHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Clean Heat – Multifamily GSHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily Program – Electric & Gas","measure":"Appliance Controls","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily Program – Electric & Gas","measure":"Appliance Controls","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily Program – Electric & Gas","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":189},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily Program – Electric & Gas","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":70},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily Program – Electric & Gas","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":39},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily Program – Electric & Gas","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":108},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily Program – Electric & Gas","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":129},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily Program – Electric & Gas","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":191},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily Program – Electric & Gas","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":105},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily Program – Electric & Gas","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":282},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily Program – Electric & Gas","measure":"Lighting Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":11},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily Program – Electric & Gas","measure":"Lighting Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":60},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily Program – Electric & Gas","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":9},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily Program – Electric & Gas","measure":"Motors and Drives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":35},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily Program – Electric & Gas","measure":"Process Equipment","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily Program – Electric & Gas","measure":"Process Equipment","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":7},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily Program – Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":483},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily Program – Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":754},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily - Fuel-Switch","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily - Fuel-Switch","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily - Fuel-Switch","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily - Fuel-Switch","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4},{"year":"2023","segment":"Multifamily / DAC","program":"Multifamily - Fuel-Switch","measure":"Multifamily Programs Total Installations","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2049},{"year":"2023","segment":"Multifamily / Non-DAC","program":"Multifamily - Fuel-Switch","measure":"Multifamily Programs Total Installations","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":961},{"year":"2024","segment":"Multisector / DAC","program":"Real Time Energy Management","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3},{"year":"2024","segment":"Multisector / Non-DAC","program":"Real Time Energy Management","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3},{"year":"2024","segment":"Residential / DAC","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":208},{"year":"2024","segment":"Residential / Non-DAC","program":"Clean Heat – Midstream Heat Pump Water Heater","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":330},{"year":"2024","segment":"Residential / DAC","program":"Clean Heat – Residential Air Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":13063},{"year":"2024","segment":"Residential / Non-DAC","program":"Clean Heat – Residential Air Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":17184},{"year":"2024","segment":"Residential / DAC","program":"Clean Heat – Residential Ground Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":17},{"year":"2024","segment":"Residential / Non-DAC","program":"Clean Heat – Residential Ground Source Heat Pump","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":173},{"year":"2024","segment":"Residential / DAC","program":"EmPower+","measure":"Appliances","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":30},{"year":"2024","segment":"Residential / Non-DAC","program":"EmPower+","measure":"Appliances","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"EmPower+","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":427},{"year":"2024","segment":"Residential / Non-DAC","program":"EmPower+","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"EmPower+","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4},{"year":"2024","segment":"Residential / Non-DAC","program":"EmPower+","measure":"Domestic Hot Water","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"EmPower+","measure":"Domestic Hot Water - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":29},{"year":"2024","segment":"Residential / Non-DAC","program":"EmPower+","measure":"Domestic Hot Water - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"EmPower+","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":8},{"year":"2024","segment":"Residential / Non-DAC","program":"EmPower+","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"EmPower+","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":48},{"year":"2024","segment":"Residential / Non-DAC","program":"EmPower+","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"EmPower+","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":199},{"year":"2024","segment":"Residential / Non-DAC","program":"EmPower+","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"EmPower+","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":105},{"year":"2024","segment":"Residential / Non-DAC","program":"EmPower+","measure":"Refrigeration","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"Marketplace","measure":"Appliance - Controls","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":23},{"year":"2024","segment":"Residential / Non-DAC","program":"Marketplace","measure":"Appliance - Controls","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":43},{"year":"2024","segment":"Residential / DAC","program":"Marketplace","measure":"Appliances","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3},{"year":"2024","segment":"Residential / Non-DAC","program":"Marketplace","measure":"Appliances","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2024","segment":"Residential / DAC","program":"Marketplace","measure":"Domestic Hot Water - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4},{"year":"2024","segment":"Residential / Non-DAC","program":"Marketplace","measure":"Domestic Hot Water - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4},{"year":"2024","segment":"Residential / DAC","program":"Marketplace","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / Non-DAC","program":"Marketplace","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2},{"year":"2024","segment":"Residential / DAC","program":"Marketplace","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":553},{"year":"2024","segment":"Residential / Non-DAC","program":"Marketplace","measure":"HVAC - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1067},{"year":"2024","segment":"Residential / DAC","program":"Marketplace","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":81},{"year":"2024","segment":"Residential / Non-DAC","program":"Marketplace","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":197},{"year":"2024","segment":"Residential / DAC","program":"Retail Lighting - LMI","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":21},{"year":"2024","segment":"Residential / Non-DAC","program":"Retail Lighting - LMI","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"Retail Products","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":112646},{"year":"2024","segment":"Residential / Non-DAC","program":"Retail Products","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":104962},{"year":"2024","segment":"Residential / DAC","program":"Smart Kids","measure":"Domestic Hot Water - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":594},{"year":"2024","segment":"Residential / Non-DAC","program":"Smart Kids","measure":"Domestic Hot Water - Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"Smart Kids","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":594},{"year":"2024","segment":"Residential / Non-DAC","program":"Smart Kids","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":865},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3562},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Incentives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":129680235},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Incentives","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":132844686},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Energy Savings (MMBtu)","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1659904},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Energy Savings (MMBtu)","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2359886},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Participation","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1205001},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Participation","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1133665},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Average Incentive per Participant","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":108},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Average Incentive per Participant","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Average Energy Savings Per Participant","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Average Energy Savings Per Participant","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Installations","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":21436},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Installations","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":35515},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Commercial","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2549},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Commercial","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":4042},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Multifamily","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2049},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Multifamily","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":961},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Multisector","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Multisector","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2024","segment":"Residential / DAC","program":"Weather Ready","measure":"Residential","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":16838},{"year":"2024","segment":"Residential / Non-DAC","program":"Weather Ready","measure":"Residential","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":30512},{"year":"2023","segment":"Commercial / DAC","program":"Clean Heat – Residential ASHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2014},{"year":"2023","segment":"Commercial / Non-DAC","program":"Clean Heat – Residential ASHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2974},{"year":"2023","segment":"Commercial / DAC","program":"Clean Heat – Residential ASHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2014},{"year":"2023","segment":"Commercial / Non-DAC","program":"Clean Heat – Residential ASHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2974},{"year":"2023","segment":"Commercial / DAC","program":"Clean Heat – Residential GSHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":19},{"year":"2023","segment":"Commercial / Non-DAC","program":"Clean Heat – Residential GSHP","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":181},{"year":"2023","segment":"Commercial / DAC","program":"Clean Heat – Residential GSHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":19},{"year":"2023","segment":"Commercial / Non-DAC","program":"Clean Heat – Residential GSHP","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":181},{"year":"2023","segment":"Commercial / DAC","program":"Marketplace Electric & Gas","measure":"Appliance","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":96},{"year":"2023","segment":"Commercial / Non-DAC","program":"Marketplace Electric & Gas","measure":"Appliance","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1327},{"year":"2023","segment":"Commercial / DAC","program":"Marketplace Electric & Gas","measure":"Appliance Controls","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":925},{"year":"2023","segment":"Commercial / Non-DAC","program":"Marketplace Electric & Gas","measure":"Appliance Controls","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1408},{"year":"2023","segment":"Commercial / DAC","program":"Marketplace Electric & Gas","measure":"Domestic Hot Water Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":76},{"year":"2023","segment":"Commercial / Non-DAC","program":"Marketplace Electric & Gas","measure":"Domestic Hot Water Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":444},{"year":"2023","segment":"Commercial / DAC","program":"Marketplace Electric & Gas","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":6420},{"year":"2023","segment":"Commercial / Non-DAC","program":"Marketplace Electric & Gas","measure":"HVAC Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":13589},{"year":"2023","segment":"Commercial / DAC","program":"Marketplace Electric & Gas","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":3483},{"year":"2023","segment":"Commercial / Non-DAC","program":"Marketplace Electric & Gas","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":6558},{"year":"2023","segment":"Commercial / DAC","program":"Marketplace Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":11000},{"year":"2023","segment":"Commercial / Non-DAC","program":"Marketplace Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":23410},{"year":"2023","segment":"Commercial / DAC","program":"Residential Weatherization Electric & Gas","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":176},{"year":"2023","segment":"Commercial / Non-DAC","program":"Residential Weatherization Electric & Gas","measure":"HVAC","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1018},{"year":"2023","segment":"Commercial / DAC","program":"Residential Weatherization Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":176},{"year":"2023","segment":"Commercial / Non-DAC","program":"Residential Weatherization Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1018},{"year":"2023","segment":"Commercial / DAC","program":"Retail Lighting","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2159},{"year":"2023","segment":"Commercial / Non-DAC","program":"Retail Lighting","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1710},{"year":"2023","segment":"Commercial / DAC","program":"Retail Lighting","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":2159},{"year":"2023","segment":"Commercial / Non-DAC","program":"Retail Lighting","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":1710},{"year":"2023","segment":"Commercial / DAC","program":"Retail Lighting LMI","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":65},{"year":"2023","segment":"Commercial / Non-DAC","program":"Retail Lighting LMI","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Commercial / DAC","program":"Retail Lighting LMI","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":65},{"year":"2023","segment":"Commercial / Non-DAC","program":"Retail Lighting LMI","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":0},{"year":"2023","segment":"Commercial / DAC","program":"Retail Products – Electric & Gas","measure":"Appliance","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":81},{"year":"2023","segment":"Commercial / Non-DAC","program":"Retail Products – Electric & Gas","measure":"Appliance","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":75},{"year":"2023","segment":"Commercial / DAC","program":"Retail Products – Electric & Gas","measure":"Appliance Controls","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":119},{"year":"2023","segment":"Commercial / Non-DAC","program":"Retail Products – Electric & Gas","measure":"Appliance Controls","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":60},{"year":"2023","segment":"Commercial / DAC","program":"Retail Products – Electric & Gas","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":344},{"year":"2023","segment":"Commercial / Non-DAC","program":"Retail Products – Electric & Gas","measure":"Building Shell","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":344},{"year":"2023","segment":"Commercial / DAC","program":"Retail Products – Electric & Gas","measure":"Domestic Hot Water Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":158},{"year":"2023","segment":"Commercial / Non-DAC","program":"Retail Products – Electric & Gas","measure":"Domestic Hot Water Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":156},{"year":"2023","segment":"Commercial / DAC","program":"Retail Products – Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":702},{"year":"2023","segment":"Commercial / Non-DAC","program":"Retail Products – Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":635},{"year":"2023","segment":"Commercial / DAC","program":"Smart Kids – Electric & Gas","measure":"Domestic Hot Water Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":276},{"year":"2023","segment":"Commercial / Non-DAC","program":"Smart Kids – Electric & Gas","measure":"Domestic Hot Water Control","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":215},{"year":"2023","segment":"Commercial / DAC","program":"Smart Kids – Electric & Gas","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":427},{"year":"2023","segment":"Commercial / Non-DAC","program":"Smart Kids – Electric & Gas","measure":"Lighting","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":369},{"year":"2023","segment":"Commercial / DAC","program":"Smart Kids – Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":703},{"year":"2023","segment":"Commercial / Non-DAC","program":"Smart Kids – Electric & Gas","measure":"Subtotal","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":584},{"year":"2023","segment":"Commercial / DAC","program":"Smart Kids – Electric & Gas","measure":"Residential Programs Total Installations","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":16838},{"year":"2023","segment":"Commercial / Non-DAC","program":"Smart Kids – Electric & Gas","measure":"Residential Programs Total Installations","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":30512}],"B":[{"year":"2024","segment":"DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","funding_dollars":18281828.0,"_table":"B1"},{"year":"2023","segment":"DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","funding_dollars":10190734.93,"_table":"B1"},{"year":"2024","segment":"Non-DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","funding_dollars":24517801.0,"_table":"B1"},{"year":"2023","segment":"Non-DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","funding_dollars":22410902.55,"_table":"B1"},{"year":"2024","segment":"Total","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","funding_dollars":42799629.0,"_table":"B1"},{"year":"2023","segment":"Total","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","funding_dollars":32601637.48,"_table":"B1"},{"year":"2024","segment":"DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"L2","plugs":1732,"_table":"B2"},{"year":"2024","segment":"DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"DCFC","plugs":118,"_table":"B2"},{"year":"2023","segment":"DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"L2","plugs":817,"_table":"B2"},{"year":"2023","segment":"DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"DCFC","plugs":82,"_table":"B2"},{"year":"2024","segment":"Non-DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"L2","plugs":2386,"_table":"B2"},{"year":"2024","segment":"Non-DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"DCFC","plugs":76,"_table":"B2"},{"year":"2023","segment":"Non-DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"L2","plugs":2081,"_table":"B2"},{"year":"2023","segment":"Non-DAC","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"DCFC","plugs":29,"_table":"B2"},{"year":"2024","segment":"Total","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"L2","plugs":4118,"_table":"B2"},{"year":"2024","segment":"Total","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"DCFC","plugs":194,"_table":"B2"},{"year":"2023","segment":"Total","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"L2","plugs":2898,"_table":"B2"},{"year":"2023","segment":"Total","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","charger_type":"DCFC","plugs":111,"_table":"B2"}],"C":[{"year":"2024","program":"Commercial System Relief Program (CSRP)","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","_table":"C1","segment":"","category":"Peak Shaving","description":"CSRP is open to customers throughout the service territory and events are called system-wide. Notifications are sent at least 21 hours prior to a planned event. Participants are called on weekdays."},{"year":"2023","program":"Commercial System Relief Program (CSRP)","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","_table":"C1","segment":"","category":"Peak Shaving","description":"CSRP is open to customers throughout the service territory and events are called system-wide. Notifications are sent at least 21 hours prior to a planned event. Participants are called on weekdays."},{"year":"2024","program":"Distribution Load Relief Program (DLRP)","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","_table":"C1","segment":"","category":"Contingency","description":"DLRP is open to customers throughout the service territory. Participants can be called any day of the week, including holidays."},{"year":"2023","program":"Distribution Load Relief Program (DLRP)","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","_table":"C1","segment":"","category":"Contingency","description":"DLRP is open to customers throughout the service territory. Participants can be called any day of the week, including holidays."},{"year":"2024","program":"Long Term-Dynamic Load Management (Term-DLM)","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","_table":"C1","segment":"","category":"Peak Shaving","description":"Participants sign multiyear contracts to provide load relief. Notifications are sent at least 21 hours prior to a planned event. Participants are called on weekdays."},{"year":"2023","program":"Long Term-Dynamic Load Management (Term-DLM)","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","_table":"C1","segment":"","category":"Peak Shaving","description":"Participants sign multiyear contracts to provide load relief. Notifications are sent at least 21 hours prior to a planned event. Participants are called on weekdays."},{"year":"2024","program":"Long Term-Dynamic Load Management (Auto-DLM)","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","_table":"C1","segment":"","category":"Peak Shaving and Contingency","description":"Participants sign multiyear contracts to provide load relief. Participants can be called any day of the week, including holidays."},{"year":"2023","program":"Long Term-Dynamic Load Management (Auto-DLM)","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","_table":"C1","segment":"","category":"Peak Shaving and Contingency","description":"Participants sign multiyear contracts to provide load relief. Participants can be called any day of the week, including holidays."},{"year":"2024","program":"Bring Your Own Thermostat (BYOT)","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","_table":"C1","segment":"","category":"Peak Shaving and Contingency","description":"A mass-market program intended for smaller commercial and residential customers with an eligible smart thermostat. For a one-time $85 incentive, customers can enable their Wi-Fi-controlled thermostat to reduce air conditioning use at times of critical system need."},{"year":"2023","program":"Bring Your Own Thermostat (BYOT)","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":"","installations":"","_table":"C1","segment":"","category":"Peak Shaving and Contingency","description":"A mass-market program intended for smaller commercial and residential customers with an eligible smart thermostat. For a one-time $85 incentive, customers can enable their Wi-Fi-controlled thermostat to reduce air conditioning use at times of critical system need."},{"year":"2024","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":32919.0,"installations":"","_table":"C2","segment":"DAC","committed_mw":404.87,"avg_event_mw":303.07},{"year":"2024","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":8929.0,"installations":"","_table":"C2","segment":"Low-Income","committed_mw":5.26,"avg_event_mw":3.33},{"year":"2024","program":"","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":104025.0,"installations":"","_table":"C2","segment":"Total","committed_mw":998.11,"avg_event_mw":766.94},{"year":"2024","program":"CSRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":14414,"installations":"","_table":"C3","segment":"DAC","committed_mw":191.42,"delivered_mw":134.64},{"year":"2024","program":"DLRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":13444,"installations":"","_table":"C3","segment":"DAC","committed_mw":193.16,"delivered_mw":148.7},{"year":"2024","program":"Term-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":152,"installations":"","_table":"C3","segment":"DAC","committed_mw":4.07,"delivered_mw":3.87},{"year":"2024","program":"Auto-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":4,"installations":"","_table":"C3","segment":"DAC","committed_mw":11.5,"delivered_mw":12.1},{"year":"2024","program":"BYOT","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":4905,"installations":"","_table":"C3","segment":"DAC","committed_mw":4.72,"delivered_mw":3.77},{"year":"2023","program":"CSRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":11048,"installations":"","_table":"C3","segment":"DAC","committed_mw":136.39,"delivered_mw":126.24},{"year":"2023","program":"DLRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":11338,"installations":"","_table":"C3","segment":"DAC","committed_mw":162.01,"delivered_mw":118.51},{"year":"2023","program":"Term-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":124,"installations":"","_table":"C3","segment":"DAC","committed_mw":7.97,"delivered_mw":6.35},{"year":"2023","program":"Auto-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":7,"installations":"","_table":"C3","segment":"DAC","committed_mw":7,"delivered_mw":2.01},{"year":"2023","program":"BYOT","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":6450,"installations":"","_table":"C3","segment":"DAC","committed_mw":6.59,"delivered_mw":5.25},{"year":"2024","program":"CSRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":4184,"installations":"","_table":"C4","segment":"Low-Income","committed_mw":2.23,"delivered_mw":0.96},{"year":"2024","program":"DLRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":3632,"installations":"","_table":"C4","segment":"Low-Income","committed_mw":2.02,"delivered_mw":1.55},{"year":"2024","program":"Term-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":10,"installations":"","_table":"C4","segment":"Low-Income","committed_mw":0.01,"delivered_mw":0.02},{"year":"2024","program":"Auto-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":0,"installations":"","_table":"C4","segment":"Low-Income","committed_mw":0,"delivered_mw":0},{"year":"2024","program":"BYOT","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":1103,"installations":"","_table":"C4","segment":"Low-Income","committed_mw":1.01,"delivered_mw":0.8},{"year":"2023","program":"CSRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":3059,"installations":"","_table":"C4","segment":"Low-Income","committed_mw":1.95,"delivered_mw":0.79},{"year":"2023","program":"DLRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":2877,"installations":"","_table":"C4","segment":"Low-Income","committed_mw":1.91,"delivered_mw":0.92},{"year":"2023","program":"Term-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":9,"installations":"","_table":"C4","segment":"Low-Income","committed_mw":0.01,"delivered_mw":0.01},{"year":"2023","program":"Auto-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":0,"installations":"","_table":"C4","segment":"Low-Income","committed_mw":0,"delivered_mw":0},{"year":"2023","program":"BYOT","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":2824,"installations":"","_table":"C4","segment":"Low-Income","committed_mw":3.33,"delivered_mw":2.66},{"year":"2024","program":"CSRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":40534,"installations":"","_table":"C5","segment":"Total","committed_mw":466.2,"delivered_mw":326.68},{"year":"2024","program":"DLRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":38649,"installations":"","_table":"C5","segment":"Total","committed_mw":472.51,"delivered_mw":374.05},{"year":"2024","program":"Term-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":708,"installations":"","_table":"C5","segment":"Total","committed_mw":11.5,"delivered_mw":12.83},{"year":"2024","program":"Auto-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":4,"installations":"","_table":"C5","segment":"Total","committed_mw":20.4,"delivered_mw":32.29},{"year":"2024","program":"BYOT","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":24130,"installations":"","_table":"C5","segment":"Total","committed_mw":27.5,"delivered_mw":21.09},{"year":"2023","program":"CSRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":32121,"installations":"","_table":"C5","segment":"Total","committed_mw":437,"delivered_mw":363},{"year":"2023","program":"DLRP","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":32426,"installations":"","_table":"C5","segment":"Total","committed_mw":488,"delivered_mw":349},{"year":"2023","program":"Term-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":533,"installations":"","_table":"C5","segment":"Total","committed_mw":25.2,"delivered_mw":25.1},{"year":"2023","program":"Auto-DLM","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":7,"installations":"","_table":"C5","segment":"Total","committed_mw":7,"delivered_mw":2},{"year":"2023","program":"BYOT","measure":"","incentive_dollars":"","energy_savings_mmbtu":"","participants":28100,"installations":"","_table":"C5","segment":"Total","committed_mw":34.4,"delivered_mw":27.5}],"D":[{"_table":"D1","year":"2024","compensation_type":"Community Distributed Generation (CDG, or Community Solar)","description":"A tariff program where a CDG host that installs a DER distributes credits to subscribing customers. Many CDG projects participate in utility consolidated billing (“net crediting”) whereby subscription fees for CDG are collected out of the credit the customer receives. The utility remits these subscription fees, less a 1% admin fee, to the CDG host."},{"_table":"D1","year":"2023","compensation_type":"Community Distributed Generation (CDG, or Community Solar)","description":"A tariff program where a CDG host that installs a DER distributes credits to subscribing customers. Many CDG projects participate in utility consolidated billing (\"net crediting\") whereby subscription fees for CDG are collected out of the credit the customer receives. The utility remits these subscription fees, less a 1% admin fee, to the CDG host."},{"_table":"D1","year":"2024","compensation_type":"Remote Crediting (RC)","description":"A tariff program whereby a remote crediting host that installs a DER distributes credits to up to 10 accounts associated with the same customer (typically commercial)."},{"_table":"D1","year":"2023","compensation_type":"Remote Crediting (RC)","description":"A tariff program where a remote crediting host that installs a DER distributes credit to their own accounts and/or up to 10 customers (typically commercial)."},{"_table":"D1","year":"2024","compensation_type":"Net-Metering (NM)","description":"A tariff program where a customer installs an eligible DER. Excess net monthly energy credits carry over and are applied against future bills."},{"_table":"D1","year":"2023","compensation_type":"Net-Metering (NM)","description":"A tariff program where a customer installs an eligible DER. Excess net monthly energy credits carry over and are applied against future bills."},{"_table":"D2","year":"2024","metric":"Total # of projects","cumulative":76991.0,"current_year":10555.0},{"_table":"D2","year":"2023","metric":"Total # of projects","cumulative":66436.0,"current_year":""},{"_table":"D2","year":"2024","metric":"Total # of projects in DACs","cumulative":24882.0,"current_year":3584.0},{"_table":"D2","year":"2023","metric":"Total # of projects in DACs","cumulative":21298.0,"current_year":""},{"_table":"D2","year":"2024","metric":"Percentage of projects in DACs","cumulative":0.323,"current_year":0.34},{"_table":"D2","year":"2023","metric":"Percentage of projects in DACs","cumulative":0.321,"current_year":""},{"_table":"D2","year":"2024","metric":"Total MW installed (All DERs)","cumulative":1096.44,"current_year":182.54},{"_table":"D2","year":"2023","metric":"Total MW installed (All DERs)","cumulative":913.9,"current_year":""},{"_table":"D2","year":"2024","metric":"Total MW installed in DACs (All DERs)","cumulative":405.92,"current_year":64.62},{"_table":"D2","year":"2023","metric":"Total MW installed in DACs (All DERs)","cumulative":341.3,"current_year":""},{"_table":"D2","year":"2024","metric":"Percentage of MW installed in DACs (All DERs)","cumulative":0.37,"current_year":0.354},{"_table":"D2","year":"2023","metric":"Percentage of MW installed in DACs (All DERs)","cumulative":0.373,"current_year":""},{"_table":"D3","year":"2024","metric":"Total # of subscribers","cumulative":18762.0,"current_year":1498.0},{"_table":"D3","year":"2023","metric":"Total # of subscribers","cumulative":17264.0,"current_year":""},{"_table":"D3","year":"2024","metric":"Total # of subscribers in DACs","cumulative":6215.0,"current_year":843.0},{"_table":"D3","year":"2023","metric":"Total # of subscribers in DACs","cumulative":5372.0,"current_year":""},{"_table":"D3","year":"2024","metric":"Percentage of subscribers in DACs","cumulative":0.331,"current_year":0.563},{"_table":"D3","year":"2023","metric":"Percentage of subscribers in DACs","cumulative":0.311,"current_year":""},{"_table":"D3","year":"2024","metric":"Total # of subscribers who are low-income customers","cumulative":1186.0,"current_year":334.0},{"_table":"D3","year":"2023","metric":"Total # of subscribers who are low-income customers","cumulative":852.0,"current_year":""},{"_table":"D3","year":"2024","metric":"Percentage of subscribers who are low-income customers","cumulative":0.063,"current_year":0.223},{"_table":"D3","year":"2023","metric":"Percentage of subscribers who are low-income customers","cumulative":0.049,"current_year":""},{"_table":"D4","year":"2024","metric":"Total # of projects","cumulative":75160.0,"current_year":10436.0},{"_table":"D4","year":"2023","metric":"Total # of projects","cumulative":64724.0,"current_year":""},{"_table":"D4","year":"2024","metric":"Total # of projects installed for low-income customers","cumulative":4470.0,"current_year":752.0},{"_table":"D4","year":"2023","metric":"Total # of projects installed for low-income customers","cumulative":3718.0,"current_year":""},{"_table":"D4","year":"2024","metric":"Percentage of projects installed for low-income customers","cumulative":0.059,"current_year":0.072},{"_table":"D4","year":"2023","metric":"Percentage of projects installed for low-income customers","cumulative":0.057,"current_year":""},{"_table":"D4","year":"2024","metric":"Total # of projects in DACs","cumulative":24062.0,"current_year":3545.0},{"_table":"D4","year":"2023","metric":"Total # of projects in DACs","cumulative":20517.0,"current_year":""},{"_table":"D4","year":"2024","metric":"Percentage of projects in DACs","cumulative":0.32,"current_year":0.4},{"_table":"D4","year":"2023","metric":"Percentage of projects in DACs","cumulative":0.317,"current_year":""},{"_table":"D4","year":"2024","metric":"Total MW installed","cumulative":688.3,"current_year":165.7},{"_table":"D4","year":"2023","metric":"Total MW installed","cumulative":522.6,"current_year":""},{"_table":"D4","year":"2024","metric":"Total MW installed for low-income customers","cumulative":22.9,"current_year":3.4},{"_table":"D4","year":"2023","metric":"Total MW installed for low-income customers","cumulative":19.5,"current_year":""},{"_table":"D4","year":"2024","metric":"Percentage MW installed for low-income customers","cumulative":0.033,"current_year":0.02},{"_table":"D4","year":"2023","metric":"Percentage MW installed for low-income customers","cumulative":0.037,"current_year":""},{"_table":"D4","year":"2024","metric":"Total MW installed in DACs","cumulative":200.82,"current_year":25.82},{"_table":"D4","year":"2023","metric":"Total MW installed in DACs","cumulative":175.0,"current_year":""},{"_table":"D4","year":"2024","metric":"Percentage MW installed in DACs","cumulative":0.292,"current_year":0.156},{"_table":"D4","year":"2023","metric":"Percentage MW installed in DACs","cumulative":0.335,"current_year":""}],"E":[{"_table":"E1","year":"2024","category":"Environmental","total_investment":70779794.0,"pct_affecting_dacs":0.53},{"_table":"E1","year":"2023","category":"Environmental","total_investment":53396000.0,"pct_affecting_dacs":0.56},{"_table":"E1","year":"2024","category":"Risk Reduction","total_investment":514647065.0,"pct_affecting_dacs":0.52},{"_table":"E1","year":"2023","category":"Risk Reduction","total_investment":697262000.0,"pct_affecting_dacs":0.42},{"_table":"E1","year":"2024","category":"Safety And Security","total_investment":24106971.0,"pct_affecting_dacs":0.54},{"_table":"E1","year":"2023","category":"Safety and Security","total_investment":19355000.0,"pct_affecting_dacs":0.54},{"_table":"E1","year":"2024","category":"System Expansion","total_investment":367058018.0,"pct_affecting_dacs":0.46},{"_table":"E1","year":"2023","category":"System Expansion","total_investment":528240000.0,"pct_affecting_dacs":0.35}],"H":[{"_table":"H1","year":"2024","borough":"Manhattan","non_dac_repairs":1242.0,"dac_repairs":462.0},{"_table":"H1","year":"2023","borough":"Manhattan","non_dac_repairs":1062.0,"dac_repairs":494.0},{"_table":"H1","year":"2024","borough":"Queens","non_dac_repairs":1321.0,"dac_repairs":245.0},{"_table":"H1","year":"2023","borough":"Queens","non_dac_repairs":1003.0,"dac_repairs":315.0},{"_table":"H1","year":"2024","borough":"Westchester","non_dac_repairs":2176.0,"dac_repairs":1279.0},{"_table":"H1","year":"2023","borough":"Westchester","non_dac_repairs":2641.0,"dac_repairs":1342.0},{"_table":"H1","year":"2024","borough":"Bronx","non_dac_repairs":365.0,"dac_repairs":1212.0},{"_table":"H1","year":"2023","borough":"Bronx","non_dac_repairs":255.0,"dac_repairs":911.0}],"I":[{"_table":"I1","year":"2024","metric":"Type of clean energy workforce development program if other than the Clean Energy Academy","unique":"The Academy is the only clean energy workforce development program the Company operated in 2024","non_unique":"The Academy is the only clean energy workforce development program the Company operated in 2024"},{"_table":"I1","year":"2023","metric":"Type of clean energy workforce development program if other than the Clean Energy Academy","unique":"The Academy is the only clean energy workforce development program the Company operated in 2023.","non_unique":"The Academy is the only clean energy workforce development program the Company operated in 2023."},{"_table":"I1","year":"2024","metric":"Number of programs the Company offers or participates in if other than the Clean Energy Academy and details on the program","unique":"N/A","non_unique":"N/A"},{"_table":"I1","year":"2023","metric":"Number of programs the Company offers or participates in if other than the Clean Energy Academy and details on the program","unique":"N/A","non_unique":"N/A"},{"_table":"I1","year":"2024","metric":"Location of [the Academy]","unique":"Online; Zoom","non_unique":"Online; Zoom"},{"_table":"I1","year":"2023","metric":"Location of [the Academy]","unique":"Online; Zoom","non_unique":"Online; Zoom"},{"_table":"I1","year":"2024","metric":"Number of students enrolled in [the Academy]","unique":"390","non_unique":"435"},{"_table":"I1","year":"2023","metric":"Number of students enrolled in [the Academy]","unique":"502","non_unique":"792"},{"_table":"I1","year":"2024","metric":"Number of students that graduate from [the Academy]","unique":"290","non_unique":"321"},{"_table":"I1","year":"2023","metric":"Number of students that graduate from [the Academy]","unique":"285","non_unique":"370"},{"_table":"I1","year":"2024","metric":"Number of jobs placed as a result of [the Academy]","unique":"87","non_unique":"89"},{"_table":"I1","year":"2023","metric":"Number of jobs placed as a result of [the Academy]","unique":"43","non_unique":"46"},{"_table":"I1","year":"2024","metric":"Number of graduate students from [the Academy] the Company has hired, and the type of jobs at Con Edison for which they were hired","unique":"1; Senior Specialist Customer Energy Solutions","non_unique":"1; Senior Specialist Customer Energy Solutions"},{"_table":"I1","year":"2023","metric":"Number of graduate students from [the Academy] the Company has hired, and the type of jobs at Con Edison for which they were hired","unique":"1; Senior Specialist Customer Energy Solutions","non_unique":"1; Senior Specialist Customer Energy Solutions"},{"_table":"I1","year":"2024","metric":"Whether or not the Con Edison jobs and hires from the [the Academy] are in the clean energy field","unique":"No: 0","non_unique":"No: 0"},{"_table":"I1","year":"2023","metric":"Whether or not the Con Edison jobs and hires from [the Academy] are in the clean energy field","unique":"Yes; 1","non_unique":"Yes; 1"},{"_table":"I1","year":"2024","metric":"Total number of hires at Con Edison from [the Academy] who resided in a disadvantaged community at the time of enrollment in the program","unique":"0","non_unique":"0"},{"_table":"I1","year":"2023","metric":"Total number of hires at Con Edison from [the Academy] who resided in a disadvantaged community at the time of enrollment in the program","unique":"1","non_unique":"1"}],"J":[{"_table":"J1","year":"2024","metric":"Total amount of residential electric usage (kWh)","dac_value":5455330732.0,"dac_pct":0.4,"nondac_value":8331039856.0,"nondac_pct":0.6},{"_table":"J1","year":"2024","metric":"Average electric usage per residential customer (kWh) [Average of the monthly average usage]","dac_value":353.2,"dac_pct":"","nondac_value":417.1,"nondac_pct":""},{"_table":"J1","year":"2023","metric":"Total amount of residential electric usage (kWh)","dac_value":4026175751.88,"dac_pct":0.39,"nondac_value":6265657893.74,"nondac_pct":0.61},{"_table":"J1","year":"2023","metric":"Average electric usage per residential customer (kWh) [Average of the monthly average usage]","dac_value":337.75,"dac_pct":0.45,"nondac_value":406.56,"nondac_pct":0.55},{"_table":"J2","year":"2024","metric":"Total amount of residential gas usage (ccf)","dac_value":264936296.0,"dac_pct":0.41,"nondac_value":381682391.0,"nondac_pct":0.59},{"_table":"J2","year":"2024","metric":"Average gas usage per residential customer (ccf) [Average of the monthly average usage]","dac_value":56.2,"dac_pct":"","nondac_value":95.3,"nondac_pct":""},{"_table":"J2","year":"2023","metric":"Total amount of residential gas usage (ccf)","dac_value":200019526.0,"dac_pct":0.46,"nondac_value":238748629.0,"nondac_pct":0.54},{"_table":"J2","year":"2023","metric":"Average gas usage per residential customer (ccf) [Average of the monthly average usage]","dac_value":49.4,"dac_pct":0.44,"nondac_value":62.36,"nondac_pct":0.56},{"_table":"J5","year":"2024","metric":"Number of residential service disconnections for non-payment","dac_value":17869.0,"dac_pct":0.6,"nondac_value":12076.0,"nondac_pct":0.4},{"_table":"J5","year":"2024","metric":"Number of residential service restorations due to payment","dac_value":13481.0,"dac_pct":0.59,"nondac_value":9544.0,"nondac_pct":0.41},{"_table":"J5","year":"2023","metric":"Number of residential service disconnections for non-payment","dac_value":30756.0,"dac_pct":0.54,"nondac_value":26458.0,"nondac_pct":0.46},{"_table":"J5","year":"2023","metric":"Number of residential service restorations due to payment","dac_value":26707.0,"dac_pct":0.54,"nondac_value":23041.0,"nondac_pct":0.46},{"_table":"J3","year":"2024","segment":"DAC","accounts":312470.0,"accounts_pct":0.64,"amount":55040891.0,"amount_pct":0.63},{"_table":"J3","year":"2024","segment":"Non-DAC","accounts":178175.0,"accounts_pct":0.36,"amount":32362554.0,"amount_pct":0.37},{"_table":"J3","year":"2023","segment":"DAC","accounts":289487.0,"accounts_pct":0.6,"amount":109831317.74,"amount_pct":0.57},{"_table":"J3","year":"2023","segment":"Non-DAC","accounts":196006.0,"accounts_pct":0.4,"amount":83042485.19,"amount_pct":0.43},{"_table":"J4","year":"2024","segment":"DAC","accounts":264398.0,"accounts_pct":0.65,"amount":563924629.0,"amount_pct":0.66},{"_table":"J4","year":"2024","segment":"Non-DAC","accounts":144161.0,"accounts_pct":0.35,"amount":292120672.0,"amount_pct":0.34},{"_table":"J4","year":"2023","segment":"DAC","accounts":179249.0,"accounts_pct":0.63,"amount":302122726.3,"amount_pct":0.66},{"_table":"J4","year":"2023","segment":"Non-DAC","accounts":107055.0,"accounts_pct":0.37,"amount":157680308.42,"amount_pct":0.34},{"_table":"J6","year":"2024","segment":"DAC","accounts":121203.0,"accounts_pct":0.6,"amount":139350179.0,"amount_pct":0.59},{"_table":"J6","year":"2024","segment":"Non-DAC","accounts":81767.0,"accounts_pct":0.4,"amount":97352921.0,"amount_pct":0.41},{"_table":"J6","year":"2023","segment":"DAC","accounts":95627.0,"accounts_pct":0.61,"amount":126681405.76,"amount_pct":0.56},{"_table":"J6","year":"2023","segment":"Non-DAC","accounts":61406.0,"accounts_pct":0.39,"amount":100223119.9,"amount_pct":0.44},{"_table":"J9","year":"2024","dac_value":1363212.0,"dac_pct":0.43,"nondac_value":1772946.0,"nondac_pct":0.57,"metric":"Residential Customers"},{"_table":"J9","year":"2023","dac_value":1344495.0,"dac_pct":0.43,"nondac_value":1760050.0,"nondac_pct":0.57,"metric":"Residential Customers"},{"_table":"J7","year":"2024","segment":"DAC","electric_only":193281.0,"gas_only":1304.0,"dual_service":101784.0,"accounts_pct":0.66},{"_table":"J7","year":"2024","segment":"Non-DAC","electric_only":127593.0,"gas_only":577.0,"dual_service":25299.0,"accounts_pct":0.34},{"_table":"J7","year":"2023","segment":"DAC","electric_only":201727.0,"gas_only":1260.0,"dual_service":114965.0,"accounts_pct":0.66},{"_table":"J7","year":"2023","segment":"Non-DAC","electric_only":134567.0,"gas_only":722.0,"dual_service":27764.0,"accounts_pct":0.34},{"_table":"J8","year":"2024","segment":"DAC","electric":162532290.0,"gas":28964404.0,"amount_pct":0.62},{"_table":"J8","year":"2024","segment":"Non-DAC","electric":95845105.0,"gas":22786170.0,"amount_pct":0.38},{"_table":"J8","year":"2023","segment":"DAC","electric":109754510.35,"gas":21993626.6,"amount_pct":0.66},{"_table":"J8","year":"2023","segment":"Non-DAC","electric":55712765.65,"gas":13525084.95,"amount_pct":0.34}],"F":[{"_table":"F1","year":"2024","term":"Distribution Network","description":"Electric distribution system design utilized by the Company, in which distribution power lines are interconnected in a mesh-like manner. This creates multiple paths for electricity to flow from the source to the load, thereby minimizing the impact of faults. If one line or transformer fails, power supply to customers can be maintained via alternate paths. The network design is predominantly seen in the underground system."},{"_table":"F1","year":"2023","term":"Distribution Network","description":"Electric distribution system design utilized by the Company, in which distribution power lines are interconnected in a mesh-like manner. This creates multiple paths for electricity to flow from the source to the load, thereby minimizing the impact of faults."},{"_table":"F1","year":"2024","term":"Non-Network Distribution","description":"Electric distribution system design utilized by the Company in which power flows in a single path from the source (substation) to the load (customer). If a fault occurs along this path, the affected section loses power until repairs are made. The non-network design is most commonly seen in the radial or overhead system (e.g., power lines on poles)."},{"_table":"F1","year":"2023","term":"Non-Network Distribution","description":"Electric distribution system design utilized by the Company in which power flows in a single path from the source (substation) to the load (customer). If a fault occurs along this path, the affected section loses power until repairs are made."},{"_table":"F1","year":"2024","term":"Distribution Secondary","description":"Any circuit distributing electricity at standard service voltage (120/208 Volts)."},{"_table":"F1","year":"2023","term":"Distribution Secondary","description":"Any circuit distributing electricity at standard service voltage (120/208 Volts)."},{"_table":"F1","year":"2024","term":"Feeder","description":"Any circuit that delivers power at 4,000, 13,000, 27,000, or 33,000 Volts."},{"_table":"F1","year":"2023","term":"Feeder","description":"Any circuit that delivers power at 4,000, 13,000, 27,000, or 33,000 Volts."},{"_table":"F1","year":"2024","term":"Distribution Load Area","description":"Any operational area in which more than 10% of customers are supplied with electricity via overhead lines."},{"_table":"F1","year":"2023","term":"Distribution Load Area","description":"Any operational area in which more than 10% of customers are supplied with electricity via overhead lines."},{"_table":"F1","year":"2024","term":"Outage","description":"The loss of service for five minutes or more, for one or more customers, because of one or more electrical component failures."},{"_table":"F1","year":"2023","term":"Outage","description":"The loss of service for five minutes or more, for one or more customers, because of one or more electrical component failures."},{"_table":"F1","year":"2024","term":"Interruption","description":"See “Outage” definition."},{"_table":"F1","year":"2023","term":"Interruption","description":"See \"Outage\" definition."},{"_table":"F1","year":"2024","term":"SAIFI","description":"System Average Interruption Frequency Index, or SAIFI, indicates how many customers experienced an outage in a particular year."},{"_table":"F1","year":"2023","term":"SAIFI","description":"System Average Interruption Frequency Index, or SAIFI, indicates how many customers experienced an outage in a particular year."},{"_table":"F1","year":"2024","term":"CAIDI","description":"Customer Average Interruption Duration Index, or CAIDI, measures the average time it took the Company to restore power to customers."},{"_table":"F1","year":"2023","term":"CAIDI","description":"Customer Average Interruption Duration Index, or CAIDI, measures the average time it took the Company to restore power to customers."},{"_table":"F1","year":"2024","term":"Excludable","description":"Outages that are omitted from the Company’s SAIFI and CAIDI metrics. They are caused by one of the following: - A storm that affects 10% or more of customers in an operating area or when customers in an operating area are out of service for 24 hours or more. - Other events outside of the Company’s control, such as coastal flooding or water main breaks."},{"_table":"F1","year":"2023","term":"Excludable","description":"Outages that are omitted from the Company’s SAIFI and CAIDI metrics. They are caused by one of the following: - A storm that affects 10% or more of customers in an operating area or when customers in an operating area are out of service for 24 hours or more. - Other events outside of the Company’s control, such as coastal flooding or water main breaks."},{"_table":"F1","year":"2024","term":"Non-Excludable","description":"Non-excludable outages count against the Company’s SAIFI and CAIDI metrics. Common causes of non-excludable outages include: - Equipment failure (i.e. transformer failure). - Cable failure. - A wire down due to interference from a tree but not related to a storm. - A storm that affects less than 10% of the customers in an operating area, or when customers in an operating area are out of service for fewer than 24 hours."},{"_table":"F1","year":"2023","term":"Non-Excludable","description":"Non-excludable outages count against the Company’s SAIFI and CAIDI metrics. Common causes of non-excludable outages include: - Equipment failure (i.e. transformer failure). - Cable failure. - A wire down due to interference from a tree but not related to a storm. - A storm that affects less than 10% of the customers in an operating area, or when customers in an operating area are out of service for fewer than 24 hours."},{"_table":"F1","year":"2024","term":"Meter","description":"A device that measures the amount of electric energy consumed by customer equipment"},{"_table":"F1","year":"2023","term":"Meter","description":"A device that measures the amount of electric energy consumed by customer equipment."},{"_table":"F1","year":"2024","term":"N-2","description":"N-2 is a design standard that ensures a system maintains full functionality when up to two major system components fail. In the Company's network design philosophy, N-2 refers to networks that will provide adequate service at peak load with the loss of up to two distribution feeders supplying the network."},{"_table":"F1","year":"2023","term":"N-2","description":"N-2 is a design standard that ensures a system maintains full functionality when up to two major system components fail. In the Company's network design philosophy, N-2 refers to networks that will provide adequate service at peak load with the loss of up to two distribution feeders supplying the network."},{"_table":"F1","year":"2024","term":"N-1","description":"N-1 is a design standard that ensures a system maintains full functionality when up to one major system component fails. In the Company's network design philosophy, N-1 refers to networks that will provide adequate service at peak load with the loss of up to one distribution feeder supplying the network"},{"_table":"F1","year":"2023","term":"N-1","description":"N-1 is a design standard that ensures a system maintains full functionality when up to one major system component fails. In the Company's network design philosophy, N-1 refers to networks that will provide adequate service at peak load with the loss of up to one distribution feeder supplying the network"},{"_table":"F2","year":"2024","outage_type":"Non-Excludable","network":42926.0,"network_pct":0.11,"non_network":346971.0,"non_network_pct":0.89},{"_table":"F2","year":"2023","outage_type":"Non-Excludable","network":31665.0,"network_pct":0.0797,"non_network":365780.0,"non_network_pct":0.9203},{"_table":"F2","year":"2024","outage_type":"Excludable","network":16948.0,"network_pct":0.19,"non_network":73619.0,"non_network_pct":0.81},{"_table":"F2","year":"2023","outage_type":"Excludable","network":3483.0,"network_pct":0.0992,"non_network":31613.0,"non_network_pct":0.9008},{"_table":"F3","year":"2024","category":"National (2023)","rate":940.0},{"_table":"F3","year":"2023","category":"National (2022)","rate":990.0},{"_table":"F3","year":"2024","category":"New York (without Con Edison) (2023)","rate":940.0},{"_table":"F3","year":"2023","category":"New York (without Con Edison) (2022)","rate":1030.0},{"_table":"F3","year":"2024","category":"Con Edison (Overhead)","rate":373.0},{"_table":"F3","year":"2023","category":"Con Edison (Overhead)","rate":398.0},{"_table":"F3","year":"2024","category":"Con Edison (Overall)","rate":106.0},{"_table":"F3","year":"2023","category":"Con Edison (Overall)","rate":110.0},{"_table":"F3","year":"2024","category":"Con Edison (Network)","rate":15.6},{"_table":"F3","year":"2023","category":"Con Edison (Network)","rate":12.0},{"_table":"F4","year":"2024","area":"Fox Hills","borough":"Staten Island","non_excludable":23968.0,"excludable":""},{"_table":"F4","year":"2023","area":"Fox Hills","borough":"Staten Island","non_excludable":28327.0,"excludable":""},{"_table":"F4","year":"2024","area":"Fresh Kills","borough":"Staten Island","non_excludable":15533.0,"excludable":""},{"_table":"F4","year":"2023","area":"Fresh Kills","borough":"Staten Island","non_excludable":5926.0,"excludable":""},{"_table":"F4","year":"2024","area":"Grasslands","borough":"Westchester","non_excludable":4399.0,"excludable":2100.0},{"_table":"F4","year":"2023","area":"Grasslands","borough":"Westchester","non_excludable":3785.0,"excludable":1053.0},{"_table":"F4","year":"2024","area":"Mohansic","borough":"Westchester","non_excludable":2626.0,"excludable":67.0},{"_table":"F4","year":"2023","area":"Mohansic","borough":"Westchester","non_excludable":755.0,"excludable":99.0},{"_table":"F4","year":"2024","area":"Pleasantville","borough":"Westchester","non_excludable":7590.0,"excludable":5223.0},{"_table":"F4","year":"2023","area":"Pleasantville","borough":"Westchester","non_excludable":8672.0,"excludable":2972.0},{"_table":"F4","year":"2024","area":"Wainwright","borough":"Staten Island","non_excludable":18708.0,"excludable":""},{"_table":"F4","year":"2023","area":"Wainwright","borough":"Staten Island","non_excludable":16220.0,"excludable":""},{"_table":"F4","year":"2024","area":"Willowbrook","borough":"Staten Island","non_excludable":12679.0,"excludable":""},{"_table":"F4","year":"2023","area":"Willowbrook","borough":"Staten Island","non_excludable":10677.0,"excludable":""},{"_table":"F4","year":"2024","area":"Woodrow","borough":"Staten Island","non_excludable":16286.0,"excludable":""},{"_table":"F4","year":"2023","area":"Woodrow","borough":"Staten Island","non_excludable":10952.0,"excludable":""},{"_table":"F5","year":"2024","area":"Bay Ridge","borough":"Brooklyn","non_excludable":1278.0,"excludable":1446.0},{"_table":"F5","year":"2024","area":"Beekman","borough":"Manhattan","non_excludable":404.0,"excludable":""},{"_table":"F5","year":"2024","area":"Borden","borough":"Queens","non_excludable":11.0,"excludable":42.0},{"_table":"F5","year":"2024","area":"Bowling Green","borough":"Manhattan","non_excludable":3.0,"excludable":""},{"_table":"F5","year":"2024","area":"Brighton Beach","borough":"Brooklyn","non_excludable":308.0,"excludable":8.0},{"_table":"F5","year":"2024","area":"Canal","borough":"Manhattan","non_excludable":17.0,"excludable":7.0},{"_table":"F5","year":"2024","area":"Central Bronx","borough":"Bronx","non_excludable":1051.0,"excludable":""},{"_table":"F5","year":"2024","area":"Central Park","borough":"Manhattan","non_excludable":581.0,"excludable":20.0},{"_table":"F5","year":"2024","area":"Chelsea","borough":"Manhattan","non_excludable":413.0,"excludable":22.0},{"_table":"F5","year":"2024","area":"City Hall","borough":"Manhattan","non_excludable":143.0,"excludable":1.0},{"_table":"F5","year":"2024","area":"Columbus Circle","borough":"Manhattan","non_excludable":101.0,"excludable":11.0},{"_table":"F5","year":"2024","area":"Cooper Square","borough":"Manhattan","non_excludable":678.0,"excludable":61.0},{"_table":"F5","year":"2024","area":"Cortlandt","borough":"Manhattan","non_excludable":3.0,"excludable":""},{"_table":"F5","year":"2024","area":"Crown Heights","borough":"Brooklyn","non_excludable":1236.0,"excludable":1098.0},{"_table":"F5","year":"2024","area":"Empire","borough":"Manhattan","non_excludable":8.0,"excludable":""},{"_table":"F5","year":"2024","area":"Fashion","borough":"Manhattan","non_excludable":306.0,"excludable":""},{"_table":"F5","year":"2024","area":"Fordham","borough":"Bronx","non_excludable":4357.0,"excludable":""},{"_table":"F5","year":"2024","area":"Grand Central","borough":"Manhattan","non_excludable":4.0,"excludable":""},{"_table":"F5","year":"2024","area":"Greenwich","borough":"Manhattan","non_excludable":100.0,"excludable":""},{"_table":"F5","year":"2024","area":"Harlem","borough":"Manhattan","non_excludable":1211.0,"excludable":84.0},{"_table":"F5","year":"2024","area":"Herald Square","borough":"Manhattan","non_excludable":1.0,"excludable":""},{"_table":"F5","year":"2024","area":"Hudson","borough":"Manhattan","non_excludable":54.0,"excludable":""},{"_table":"F5","year":"2024","area":"Kips Bay","borough":"Manhattan","non_excludable":91.0,"excludable":40.0},{"_table":"F5","year":"2024","area":"Lenox Hill","borough":"Manhattan","non_excludable":1101.0,"excludable":14.0},{"_table":"F5","year":"2024","area":"Lincoln Square","borough":"Manhattan","non_excludable":639.0,"excludable":1.0},{"_table":"F5","year":"2024","area":"Long Island City","borough":"Queens","non_excludable":2329.0,"excludable":242.0},{"_table":"F5","year":"2024","area":"Madison Square","borough":"Manhattan","non_excludable":116.0,"excludable":26.0},{"_table":"F5","year":"2024","area":"Park Place","borough":"Manhattan","non_excludable":38.0,"excludable":""},{"_table":"F5","year":"2024","area":"Pennsylvania","borough":"Manhattan","non_excludable":15.0,"excludable":""},{"_table":"F5","year":"2024","area":"Plaza","borough":"Manhattan","non_excludable":10.0,"excludable":""},{"_table":"F5","year":"2024","area":"Prospect Park","borough":"Brooklyn","non_excludable":229.0,"excludable":564.0},{"_table":"F5","year":"2024","area":"Roosevelt","borough":"Manhattan","non_excludable":208.0,"excludable":""},{"_table":"F5","year":"2024","area":"Sheridan Square","borough":"Manhattan","non_excludable":696.0,"excludable":45.0},{"_table":"F5","year":"2024","area":"Sunnyside","borough":"Queens","non_excludable":246.0,"excludable":244.0},{"_table":"F5","year":"2024","area":"Sutton","borough":"Manhattan","non_excludable":11.0,"excludable":""},{"_table":"F5","year":"2024","area":"Triboro","borough":"Manhattan","non_excludable":388.0,"excludable":163.0},{"_table":"F5","year":"2024","area":"Washington Heights","borough":"Manhattan","non_excludable":1682.0,"excludable":1.0},{"_table":"F5","year":"2024","area":"West Bronx","borough":"Bronx","non_excludable":1210.0,"excludable":""},{"_table":"F5","year":"2024","area":"Yorkville","borough":"Manhattan","non_excludable":597.0,"excludable":218.0},{"_table":"F5","year":"2023","area":"Battery Park City","borough":"Manhattan","non_excludable":"","excludable":""},{"_table":"F5","year":"2023","area":"Beekman","borough":"Manhattan","non_excludable":21.0,"excludable":""},{"_table":"F5","year":"2023","area":"Borden","borough":"Queens","non_excludable":211.0,"excludable":1.0},{"_table":"F5","year":"2023","area":"Bowling Green","borough":"Manhattan","non_excludable":7.0,"excludable":""},{"_table":"F5","year":"2023","area":"Brighton Beach","borough":"Brooklyn","non_excludable":492.0,"excludable":36.0},{"_table":"F5","year":"2023","area":"Canal","borough":"Manhattan","non_excludable":43.0,"excludable":""},{"_table":"F5","year":"2023","area":"Central Bronx","borough":"Bronx","non_excludable":751.0,"excludable":""},{"_table":"F5","year":"2023","area":"Central Park","borough":"Manhattan","non_excludable":675.0,"excludable":""},{"_table":"F5","year":"2023","area":"Chelsea","borough":"Manhattan","non_excludable":226.0,"excludable":""},{"_table":"F5","year":"2023","area":"City Hall","borough":"Manhattan","non_excludable":325.0,"excludable":""},{"_table":"F5","year":"2023","area":"Columbus Circle","borough":"Manhattan","non_excludable":78.0,"excludable":""},{"_table":"F5","year":"2023","area":"Cooper Square","borough":"Manhattan","non_excludable":961.0,"excludable":""},{"_table":"F5","year":"2023","area":"Cortlandt","borough":"Manhattan","non_excludable":27.0,"excludable":""},{"_table":"F5","year":"2023","area":"Crown Heights","borough":"Brooklyn","non_excludable":1451.0,"excludable":375.0},{"_table":"F5","year":"2023","area":"Empire","borough":"Manhattan","non_excludable":40.0,"excludable":""},{"_table":"F5","year":"2023","area":"Fashion","borough":"Manhattan","non_excludable":15.0,"excludable":""},{"_table":"F5","year":"2023","area":"Freedom","borough":"Manhattan","non_excludable":"","excludable":""},{"_table":"F5","year":"2023","area":"Fulton","borough":"Manhattan","non_excludable":18.0,"excludable":""},{"_table":"F5","year":"2023","area":"Grand Central","borough":"Manhattan","non_excludable":"","excludable":""},{"_table":"F5","year":"2023","area":"Greeley Square","borough":"Manhattan","non_excludable":9.0,"excludable":""},{"_table":"F5","year":"2023","area":"Greenwich","borough":"Manhattan","non_excludable":6.0,"excludable":""},{"_table":"F5","year":"2023","area":"Harlem","borough":"Manhattan","non_excludable":154.0,"excludable":""},{"_table":"F5","year":"2023","area":"Herald Square","borough":"Manhattan","non_excludable":"","excludable":""},{"_table":"F5","year":"2023","area":"Hudson","borough":"Manhattan","non_excludable":35.0,"excludable":""},{"_table":"F5","year":"2023","area":"Hunter","borough":"Manhattan","non_excludable":1.0,"excludable":""},{"_table":"F5","year":"2023","area":"Kips Bay","borough":"Manhattan","non_excludable":193.0,"excludable":""},{"_table":"F5","year":"2023","area":"Lenox Hill","borough":"Manhattan","non_excludable":128.0,"excludable":""},{"_table":"F5","year":"2023","area":"Lincoln Square","borough":"Manhattan","non_excludable":265.0,"excludable":""},{"_table":"F5","year":"2023","area":"Long Island City","borough":"Queens","non_excludable":332.0,"excludable":1.0},{"_table":"F5","year":"2023","area":"Madison Square","borough":"Manhattan","non_excludable":550.0,"excludable":""},{"_table":"F5","year":"2023","area":"Midtown West","borough":"Manhattan","non_excludable":56.0,"excludable":""},{"_table":"F5","year":"2023","area":"Park Place","borough":"Manhattan","non_excludable":"","excludable":""},{"_table":"F5","year":"2023","area":"Pennsylvania","borough":"Manhattan","non_excludable":"","excludable":""},{"_table":"F5","year":"2023","area":"Plaza","borough":"Manhattan","non_excludable":"","excludable":""},{"_table":"F5","year":"2023","area":"Prospect Park","borough":"Brooklyn","non_excludable":670.0,"excludable":27.0},{"_table":"F5","year":"2023","area":"Randall's Island","borough":"Manhattan","non_excludable":"","excludable":""},{"_table":"F5","year":"2023","area":"Rockefeller Center","borough":"Manhattan","non_excludable":"","excludable":""},{"_table":"F5","year":"2023","area":"Roosevelt","borough":"Manhattan","non_excludable":"","excludable":""},{"_table":"F5","year":"2023","area":"Sheridan Square","borough":"Manhattan","non_excludable":877.0,"excludable":""},{"_table":"F5","year":"2023","area":"Sunnyside","borough":"Queens","non_excludable":165.0,"excludable":1.0},{"_table":"F5","year":"2023","area":"Sutton","borough":"Manhattan","non_excludable":138.0,"excludable":""},{"_table":"F5","year":"2023","area":"Times Square","borough":"Manhattan","non_excludable":5.0,"excludable":""},{"_table":"F5","year":"2023","area":"Triboro","borough":"Manhattan","non_excludable":415.0,"excludable":""},{"_table":"F5","year":"2023","area":"Turtle Bay","borough":"Manhattan","non_excludable":5.0,"excludable":""},{"_table":"F5","year":"2023","area":"Washington Heights","borough":"Manhattan","non_excludable":791.0,"excludable":""},{"_table":"F5","year":"2023","area":"West Bronx","borough":"Bronx","non_excludable":411.0,"excludable":""},{"_table":"F5","year":"2023","area":"Yorkville","borough":"Manhattan","non_excludable":1066.0,"excludable":""},{"_table":"F6","year":"2024","area":"Borough Hall","borough":"Brooklyn","nn_non_excludable":1526.0,"nn_excludable":"","n_non_excludable":877.0,"n_excludable":688.0},{"_table":"F6","year":"2024","area":"Buchanan","borough":"Westchester","nn_non_excludable":14956.0,"nn_excludable":2139.0,"n_non_excludable":72.0,"n_excludable":""},{"_table":"F6","year":"2024","area":"Cedar Street","borough":"Westchester","nn_non_excludable":18115.0,"nn_excludable":4545.0,"n_non_excludable":4.0,"n_excludable":""},{"_table":"F6","year":"2024","area":"Elmsford No. 2","borough":"Westchester","nn_non_excludable":12729.0,"nn_excludable":7649.0,"n_non_excludable":"","n_excludable":""},{"_table":"F6","year":"2024","area":"Flatbush","borough":"","nn_non_excludable":4237.0,"nn_excludable":56.0,"n_non_excludable":2117.0,"n_excludable":1159.0},{"_table":"F6","year":"2024","area":"Flushing","borough":"Queens","nn_non_excludable":11263.0,"nn_excludable":165.0,"n_non_excludable":1115.0,"n_excludable":242.0},{"_table":"F6","year":"2024","area":"Granite Hill","borough":"Westchester","nn_non_excludable":15104.0,"nn_excludable":4286.0,"n_non_excludable":463.0,"n_excludable":""},{"_table":"F6","year":"2024","area":"Jackson Heights","borough":"Queens","nn_non_excludable":1178.0,"nn_excludable":1.0,"n_non_excludable":917.0,"n_excludable":359.0},{"_table":"F6","year":"2024","area":"Jamaica","borough":"Queens","nn_non_excludable":13914.0,"nn_excludable":371.0,"n_non_excludable":804.0,"n_excludable":317.0},{"_table":"F6","year":"2024","area":"Maspeth","borough":"Queens","nn_non_excludable":10881.0,"nn_excludable":13.0,"n_non_excludable":3389.0,"n_excludable":675.0},{"_table":"F6","year":"2024","area":"Millwood West","borough":"Westchester","nn_non_excludable":11717.0,"nn_excludable":2777.0,"n_non_excludable":1.0,"n_excludable":""},{"_table":"F6","year":"2024","area":"Northeast Bronx","borough":"Brooklyn","nn_non_excludable":23531.0,"nn_excludable":10982.0,"n_non_excludable":727.0,"n_excludable":""},{"_table":"F6","year":"2024","area":"Ocean Parkway","borough":"Bronx","nn_non_excludable":27892.0,"nn_excludable":6.0,"n_non_excludable":970.0,"n_excludable":845.0},{"_table":"F6","year":"2024","area":"Ossining West","borough":"Westchester","nn_non_excludable":7953.0,"nn_excludable":4342.0,"n_non_excludable":"","n_excludable":""},{"_table":"F6","year":"2024","area":"Park Slope","borough":"Brooklyn","nn_non_excludable":3861.0,"nn_excludable":"","n_non_excludable":1444.0,"n_excludable":1129.0},{"_table":"F6","year":"2024","area":"Richmond Hill","borough":"Queens","nn_non_excludable":6721.0,"nn_excludable":746.0,"n_non_excludable":2077.0,"n_excludable":863.0},{"_table":"F6","year":"2024","area":"Ridgewood","borough":"Westchester","nn_non_excludable":297.0,"nn_excludable":3.0,"n_non_excludable":1427.0,"n_excludable":3362.0},{"_table":"F6","year":"2024","area":"Riverdale","borough":"Bronx","nn_non_excludable":4318.0,"nn_excludable":3287.0,"n_non_excludable":253.0,"n_excludable":""},{"_table":"F6","year":"2024","area":"Rockview","borough":"Westchester","nn_non_excludable":6846.0,"nn_excludable":3597.0,"n_non_excludable":52.0,"n_excludable":""},{"_table":"F6","year":"2024","area":"Sheepshead Bay","borough":"Brooklyn","nn_non_excludable":35.0,"nn_excludable":"","n_non_excludable":684.0,"n_excludable":384.0},{"_table":"F6","year":"2024","area":"Southeast Bronx","borough":"Bronx","nn_non_excludable":5714.0,"nn_excludable":115.0,"n_non_excludable":1022.0,"n_excludable":""},{"_table":"F6","year":"2024","area":"Washington Street","borough":"Westchester","nn_non_excludable":12350.0,"nn_excludable":8919.0,"n_non_excludable":7.0,"n_excludable":""},{"_table":"F6","year":"2024","area":"White Plains","borough":"Westchester","nn_non_excludable":7288.0,"nn_excludable":4912.0,"n_non_excludable":347.0,"n_excludable":""},{"_table":"F6","year":"2024","area":"Williamsburg","borough":"Brooklyn","nn_non_excludable":6.0,"nn_excludable":"","n_non_excludable":1907.0,"n_excludable":1851.0},{"_table":"F6","year":"2023","area":"Bay Ridge","borough":"Brooklyn","nn_non_excludable":"","nn_excludable":"","n_non_excludable":1135.0,"n_excludable":85.0},{"_table":"F6","year":"2023","area":"Borough Hall","borough":"Brooklyn","nn_non_excludable":1244.0,"nn_excludable":"","n_non_excludable":591.0,"n_excludable":289.0},{"_table":"F6","year":"2023","area":"Buchanan","borough":"Westchester","nn_non_excludable":15311.0,"nn_excludable":3595.0,"n_non_excludable":73.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Cedar Street","borough":"Westchester","nn_non_excludable":8358.0,"nn_excludable":1447.0,"n_non_excludable":30.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Elmsford No. 2","borough":"Westchester","nn_non_excludable":19499.0,"nn_excludable":4565.0,"n_non_excludable":183.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Flatbush","borough":"Brooklyn","nn_non_excludable":1612.0,"nn_excludable":40.0,"n_non_excludable":1217.0,"n_excludable":720.0},{"_table":"F6","year":"2023","area":"Flushing","borough":"Queens","nn_non_excludable":11734.0,"nn_excludable":323.0,"n_non_excludable":6.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Fordham","borough":"Bronx","nn_non_excludable":"","nn_excludable":"","n_non_excludable":1515.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Granite Hill","borough":"Westchester","nn_non_excludable":19890.0,"nn_excludable":2448.0,"n_non_excludable":766.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Harrison","borough":"Westchester","nn_non_excludable":14641.0,"nn_excludable":3201.0,"n_non_excludable":"","n_excludable":""},{"_table":"F6","year":"2023","area":"Jackson Heights","borough":"Queens","nn_non_excludable":464.0,"nn_excludable":"","n_non_excludable":792.0,"n_excludable":6.0},{"_table":"F6","year":"2023","area":"Jamaica","borough":"Queens","nn_non_excludable":21306.0,"nn_excludable":517.0,"n_non_excludable":84.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Maspeth","borough":"Queens","nn_non_excludable":18014.0,"nn_excludable":2372.0,"n_non_excludable":12.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Millwood West","borough":"Westchester","nn_non_excludable":13664.0,"nn_excludable":1815.0,"n_non_excludable":"","n_excludable":""},{"_table":"F6","year":"2023","area":"Northeast Bronx","borough":"Bronx","nn_non_excludable":30000.0,"nn_excludable":1.0,"n_non_excludable":495.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Ocean Parkway","borough":"Brooklyn","nn_non_excludable":8404.0,"nn_excludable":69.0,"n_non_excludable":884.0,"n_excludable":42.0},{"_table":"F6","year":"2023","area":"Ossining West","borough":"Westchester","nn_non_excludable":10405.0,"nn_excludable":3630.0,"n_non_excludable":"","n_excludable":""},{"_table":"F6","year":"2023","area":"Park Slope","borough":"Brooklyn","nn_non_excludable":2114.0,"nn_excludable":54.0,"n_non_excludable":1161.0,"n_excludable":138.0},{"_table":"F6","year":"2023","area":"Rego Park","borough":"Queens","nn_non_excludable":4206.0,"nn_excludable":1332.0,"n_non_excludable":45.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Richmond Hill","borough":"Queens","nn_non_excludable":7570.0,"nn_excludable":3.0,"n_non_excludable":1689.0,"n_excludable":27.0},{"_table":"F6","year":"2023","area":"Ridgewood","borough":"Brooklyn","nn_non_excludable":"","nn_excludable":"","n_non_excludable":24.0,"n_excludable":1253.0},{"_table":"F6","year":"2023","area":"Riverdale","borough":"Bronx","nn_non_excludable":4312.0,"nn_excludable":237.0,"n_non_excludable":"","n_excludable":""},{"_table":"F6","year":"2023","area":"Rockview","borough":"Westchester","nn_non_excludable":7519.0,"nn_excludable":1051.0,"n_non_excludable":"","n_excludable":""},{"_table":"F6","year":"2023","area":"Sheepshead Bay","borough":"Brooklyn","nn_non_excludable":27.0,"nn_excludable":"","n_non_excludable":769.0,"n_excludable":265.0},{"_table":"F6","year":"2023","area":"Southeast Bronx","borough":"Bronx","nn_non_excludable":10421.0,"nn_excludable":327.0,"n_non_excludable":877.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Washington Street","borough":"Westchester","nn_non_excludable":40040.0,"nn_excludable":3810.0,"n_non_excludable":141.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"White Plains","borough":"Westchester","nn_non_excludable":9554.0,"nn_excludable":1433.0,"n_non_excludable":483.0,"n_excludable":""},{"_table":"F6","year":"2023","area":"Williamsburg","borough":"Brooklyn","nn_non_excludable":135.0,"nn_excludable":"","n_non_excludable":1216.0,"n_excludable":849.0},{"_table":"F7","year":"2024","outage_type":"Non-Excludable","dac_customers":128811.0,"nondac_customers":261086.0},{"_table":"F7","year":"2023","outage_type":"Non-Excludable","dac_customers":152197.0,"nondac_customers":245248.0},{"_table":"F7","year":"2024","outage_type":"Excludable","dac_customers":35904.0,"nondac_customers":54663.0},{"_table":"F7","year":"2023","outage_type":"Excludable","dac_customers":10173.0,"nondac_customers":24923.0},{"_table":"F8","year":"2024","borough":"Bronx","dac":416963.0,"dac_pct":0.11,"non_dac":44302.0,"non_dac_pct":0.01},{"_table":"F8","year":"2023","borough":"Bronx","dac":423720.0,"dac_pct":0.12,"non_dac":64644.0,"non_dac_pct":0.02},{"_table":"F8","year":"2024","borough":"Brooklyn","dac":386484.0,"dac_pct":0.1,"non_dac":607622.0,"non_dac_pct":0.16},{"_table":"F8","year":"2023","borough":"Brooklyn","dac":427443.0,"dac_pct":0.12,"non_dac":602476.0,"non_dac_pct":0.16},{"_table":"F8","year":"2024","borough":"Manhattan","dac":263679.0,"dac_pct":0.07,"non_dac":518622.0,"non_dac_pct":0.14},{"_table":"F8","year":"2023","borough":"Manhattan","dac":251732.0,"dac_pct":0.07,"non_dac":523782.0,"non_dac_pct":0.14},{"_table":"F8","year":"2024","borough":"Queens","dac":364609.0,"dac_pct":0.1,"non_dac":632000.0,"non_dac_pct":0.17},{"_table":"F8","year":"2023","borough":"Queens","dac":276051.0,"dac_pct":0.08,"non_dac":537971.0,"non_dac_pct":0.15},{"_table":"F8","year":"2024","borough":"Staten Island","dac":50429.0,"dac_pct":0.01,"non_dac":134986.0,"non_dac_pct":0.04},{"_table":"F8","year":"2023","borough":"Staten Island","dac":49336.0,"dac_pct":0.01,"non_dac":134767.0,"non_dac_pct":0.04},{"_table":"F8","year":"2024","borough":"Westchester","dac":195590.0,"dac_pct":0.05,"non_dac":204731.0,"non_dac_pct":0.05},{"_table":"F8","year":"2023","borough":"Westchester","dac":166708.0,"dac_pct":0.05,"non_dac":203758.0,"non_dac_pct":0.06},{"_table":"F9","year":"2024","borough":"Bronx","dac":38472.0,"dac_pct":0.01,"non_dac":18095.0,"non_dac_pct":0.005},{"_table":"F9","year":"2023","borough":"Bronx","dac":53720.0,"dac_pct":0.0147,"non_dac":18505.0,"non_dac_pct":0.005},{"_table":"F9","year":"2024","borough":"Brooklyn","dac":19607.0,"dac_pct":0.005,"non_dac":43323.0,"non_dac_pct":0.011},{"_table":"F9","year":"2023","borough":"Brooklyn","dac":10862.0,"dac_pct":0.003,"non_dac":21073.0,"non_dac_pct":0.006},{"_table":"F9","year":"2024","borough":"Manhattan","dac":3789.0,"dac_pct":0.001,"non_dac":6544.0,"non_dac_pct":0.002},{"_table":"F9","year":"2023","borough":"Manhattan","dac":2190.0,"dac_pct":0.0006,"non_dac":4940.0,"non_dac_pct":0.001},{"_table":"F9","year":"2024","borough":"Queens","dac":16676.0,"dac_pct":0.004,"non_dac":51238.0,"non_dac_pct":0.013},{"_table":"F9","year":"2023","borough":"Queens","dac":12195.0,"dac_pct":0.0033,"non_dac":54945.0,"non_dac_pct":0.015},{"_table":"F9","year":"2024","borough":"Staten Island","dac":21379.0,"dac_pct":0.006,"non_dac":65795.0,"non_dac_pct":0.017},{"_table":"F9","year":"2023","borough":"Staten Island","dac":19214.0,"dac_pct":0.0052,"non_dac":52888.0,"non_dac_pct":0.014},{"_table":"F9","year":"2024","borough":"Westchester","dac":64793.0,"dac_pct":0.017,"non_dac":130753.0,"non_dac_pct":0.034},{"_table":"F9","year":"2023","borough":"Westchester","dac":64189.0,"dac_pct":0.0175,"non_dac":117820.0,"non_dac_pct":0.032}],"G":[{"_table":"G1","year":"2024","category":"Feet Replaced within DAC","percentage":0.46},{"_table":"G1","year":"2023","category":"Total Footage Replaced within DACs","percentage":0.46},{"_table":"G1","year":"2024","category":"Feet Replaced not in a DAC","percentage":0.54},{"_table":"G1","year":"2023","category":"Total Footage Replaced not in DACs","percentage":0.54},{"_table":"G2","year":"2024","segment":"DAC","feet":72504.0,"percentage":0.83},{"_table":"G2","year":"2024","segment":"Non-DAC","feet":14991.0,"percentage":0.17},{"_table":"G3","year":"2024","segment":"DAC","feet":2553.0,"percentage":0.7},{"_table":"G3","year":"2024","segment":"Non-DAC","feet":1135.0,"percentage":0.3},{"_table":"G4","year":"2024","segment":"DAC","feet":16917.0,"percentage":0.42},{"_table":"G4","year":"2024","segment":"Non-DAC","feet":23618.0,"percentage":0.58},{"_table":"G5","year":"2024","segment":"DAC","feet":533.0,"percentage":0.54},{"_table":"G5","year":"2024","segment":"Non-DAC","feet":542.0,"percentage":0.46},{"_table":"G6","year":"2024","segment":"DAC","feet":18752.0,"percentage":0.23},{"_table":"G6","year":"2024","segment":"Non-DAC","feet":62282.0,"percentage":0.77},{"_table":"G7","year":"2024","segment":"DAC","feet":0.0,"percentage":0.0},{"_table":"G7","year":"2024","segment":"Non-DAC","feet":1793.0,"percentage":1.0},{"_table":"G8","year":"2024","segment":"DAC","feet":82499.0,"percentage":0.41},{"_table":"G8","year":"2024","segment":"Non-DAC","feet":119712.0,"percentage":0.59},{"_table":"G9","year":"2024","segment":"DAC","feet":1242.0,"percentage":0.32},{"_table":"G9","year":"2024","segment":"Non-DAC","feet":2649.0,"percentage":0.68},{"_table":"G2","year":"2023","segment":"DAC","feet":78020.0,"percentage":0.9},{"_table":"G2","year":"2023","segment":"Non-DAC","feet":8932.0,"percentage":0.1},{"_table":"G4","year":"2023","segment":"DAC","feet":14672.0,"percentage":0.34},{"_table":"G4","year":"2023","segment":"Non-DAC","feet":28993.0,"percentage":0.66},{"_table":"G6","year":"2023","segment":"DAC","feet":27908.0,"percentage":0.34},{"_table":"G6","year":"2023","segment":"Non-DAC","feet":53498.0,"percentage":0.66},{"_table":"G8","year":"2023","segment":"DAC","feet":73462.0,"percentage":0.35},{"_table":"G8","year":"2023","segment":"Non-DAC","feet":136943.0,"percentage":0.65},{"_table":"G10","year":"2024","category":"Total mT CH4 in Non-DACs","mt_ch4":116.03,"percentage":0.48},{"_table":"G10","year":"2024","category":"Total mT CH4 in DACs","mt_ch4":125.19,"percentage":0.52},{"_table":"G10","year":"2023","category":"Total mT CH4 in Non-DACs","mt_ch4":129.3,"percentage":0.54},{"_table":"G10","year":"2023","category":"Total mT CH4 in DACs","mt_ch4":109.59,"percentage":0.46}]};

  const STORAGE_KEY = 'coned_dac_ingestion_rows_v12';
  const SEED_FLAG = 'coned_dac_ingestion_seeded_v12';

  const state = { section: 'A', table: 'A1', year: '2024' };

  // ============================================================
  // STORAGE
  // ============================================================
  function loadAllRows() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveAllRows(rows) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); }
    catch (e) { alert('Storage failed: ' + e.message); }
  }
  function newId() {
    return 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function seedIfNeeded() {
    if (localStorage.getItem(SEED_FLAG) === '1') return;
    const all = [];
    Object.keys(SEED_DATA).forEach(letter => {
      SEED_DATA[letter].forEach((values, idx) => {
        all.push({
          id: 'seed_' + letter + '_' + idx,
          section: letter,
          values: values,
          status: 'imported',
          created_at: new Date().toISOString()
        });
      });
    });
    saveAllRows(all);
    localStorage.setItem(SEED_FLAG, '1');
  }

  function getAvailableYears(section) {
    const all = loadAllRows().filter(r => r.section === section);
    const years = new Set();
    all.forEach(r => {
      if (r.values && r.values.year) years.add(String(r.values.year));
    });
    const sorted = Array.from(years).sort().reverse();
    return sorted.length ? sorted : ['2024'];
  }

  // ============================================================
  // FORMATTING
  // ============================================================
  function fmtMoney(v) {
    if (v == null || v === '' || isNaN(v)) return '';
    return '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  function fmtNum(v, decimals) {
    if (v == null || v === '' || isNaN(v)) return '';
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: decimals != null ? decimals : 0 });
  }
  function fmtPct(v) {
    if (v == null || isNaN(v) || !isFinite(v)) return '—';
    return (v * 100).toFixed(1) + '%';
  }
  function parseNumberInput(str) {
    if (str == null) return null;
    const cleaned = String(str).replace(/[$,\s]/g, '');
    if (cleaned === '') return null;
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  // ============================================================
  // TABLE DEFINITIONS
  // ============================================================
  const TABLES_A = [
    { id:'A1', label:'A1. Incentive Dollars', title:'Incentive Dollars Spent', desc:'Funds expended per program with DAC share.', kind:'a1a2', measure:'incentive_dollars', unit:'$', editable:true },
    { id:'A2', label:'A2. Energy Savings', title:'Energy Savings Achieved (Lifetime MMBtu)', desc:'Lifetime MMBtu saved per program with DAC share.', kind:'a1a2', measure:'energy_savings_mmbtu', unit:'MMBtu', editable:true },
    { id:'A3', label:'A3. Participants', title:'Total Participants and Average Savings/Incentives per Participant', desc:'Per-program counts grouped by participant type. Averages derived.', kind:'a3a4', isDac:false, editable:true },
    { id:'A4', label:'A4. DAC Participants', title:'DAC Participants and Average Savings/Incentives per Participant', desc:'Same as A3 but limited to DAC participants.', kind:'a3a4', isDac:true, editable:true },
    { id:'A5', label:'A5. Commercial Installs', title:'Installations by Measure Category — Commercial', desc:'Commercial installations by program then measure category.', kind:'a5a8', segmentBase:'Commercial', editable:true },
    { id:'A6', label:'A6. Multifamily Installs', title:'Installations by Measure Category — Multifamily', desc:'Multifamily installations by program then measure category.', kind:'a5a8', segmentBase:'Multifamily', editable:true },
    { id:'A7', label:'A7. Multisector Installs', title:'Installations by Measure Category — Multisector', desc:'Multisector installations by program then measure category.', kind:'a5a8', segmentBase:'Multisector', editable:true },
    { id:'A8', label:'A8. Residential Installs', title:'Installations by Measure Category — Residential', desc:'Residential installations by program then measure category.', kind:'a5a8', segmentBase:'Residential', editable:true },
    { id:'A9', label:'A9. YoY Summary ($ + MMBtu)', title:'Incentives + Savings — Year-over-Year Summary', desc:'Read-only. Aggregated from A1 + A2 across years.', kind:'derived', editable:false },
    { id:'A10', label:'A10. YoY Installations', title:'Installations — Year-over-Year Summary', desc:'Read-only. Aggregated from A5–A8 across years.', kind:'derived', editable:false }
  ];
  const TABLES_B = [
    { id:'B1', label:'B1. Funding Spent', title:'Total Make-Ready Incentive Funding Spent', desc:'Total funding by segment (DAC, Non-DAC, Total).', kind:'bSimple', editable:true },
    { id:'B2', label:'B2. Charging Plugs', title:'Charging Plugs Completed Under the Make-Ready Program', desc:'Number of plugs by segment and type (L2, DCFC).', kind:'bMatrix', editable:true }
  ];
  const TABLES_C = [
    { id:'C1', label:'C1. Programs Summary', title:'Summary of Con Edison Demand Response Programs', desc:'Descriptive list of demand-response programs with their category and description.', kind:'cDescriptive', editable:true },
    { id:'C2', label:'C2. Participation by Customer Group', title:'Participation Summary by Customer Group', desc:'Top-level rollup by Customer Group (DAC, Low-Income, Total).', kind:'cMatrix2', editable:true },
    { id:'C3', label:'C3. DAC Programs', title:'DAC Program Participation Summary', desc:'Demand-response participation by program, limited to DAC customers.', kind:'cProgram', segment:'DAC', editable:true },
    { id:'C4', label:'C4. Low-Income Programs', title:'Low-Income Program Participation Summary', desc:'Demand-response participation by program, limited to Low-Income customers.', kind:'cProgram', segment:'Low-Income', editable:true },
    { id:'C5', label:'C5. Total Programs', title:'Total Program Participation Summary', desc:'Demand-response participation by program across all customer groups.', kind:'cProgram', segment:'Total', editable:true }
  ];
  const D2_METRICS = [
    'Total # of projects',
    'Total # of projects in DACs',
    'Percentage of projects in DACs',
    'Total MW installed (All DERs)',
    'Total MW installed in DACs (All DERs)',
    'Percentage of MW installed in DACs (All DERs)'
  ];
  const D3_METRICS = [
    'Total # of subscribers',
    'Total # of subscribers in DACs',
    'Percentage of subscribers in DACs',
    'Total # of subscribers who are low-income customers',
    'Percentage of subscribers who are low-income customers'
  ];
  const D4_METRICS = [
    'Total # of projects',
    'Total # of projects installed for low-income customers',
    'Percentage of projects installed for low-income customers',
    'Total # of projects in DACs',
    'Percentage of projects in DACs',
    'Total MW installed',
    'Total MW installed for low-income customers',
    'Percentage MW installed for low-income customers',
    'Total MW installed in DACs',
    'Percentage MW installed in DACs'
  ];

  const TABLES_D = [
    { id:'D1', label:'D1. Compensation Types', title:'Typical Compensation Types for Distributed Energy Resources', desc:'Descriptive list of compensation types (CDG, RC, NM) and their definitions.', kind:'dDescriptive', editable:true },
    { id:'D2', label:'D2. All DERs', title:'All Distribution-Interconnected Projects (Including CDG, RC, NM)', desc:'Cumulative DER projects and MW installed; current year and prior cumulative columns.', kind:'dCumulative', metrics: D2_METRICS, editable:true },
    { id:'D3', label:'D3. CDG / RC', title:'Community DG and Remote Crediting Projects', desc:'Subscriber-level metrics for CDG and RC programs.', kind:'dCumulative', metrics: D3_METRICS, editable:true },
    { id:'D4', label:'D4. Net Metering', title:'Net Metering Projects', desc:'Net Metering projects, including low-income breakouts.', kind:'dCumulative', metrics: D4_METRICS, editable:true }
  ];
  const TABLES_E = [
    { id:'E1', label:'E1. Strategic Capital Investments', title:'Strategic Electric Capital Investments', desc:'Investment categories with total spend and percentage affecting DACs.', kind:'eMatrix', editable:true }
  ];

  const TABLES_H = [
    { id:'H1', label:'H1. Leak Repairs by Borough', title:'Total Leaks Repaired in DACs and Non-DACs',
      desc:'Number of natural gas leak repairs by borough/county, broken out by DAC and Non-DAC.',
      kind:'hBoroughs', editable:true }
  ];
  const TABLES_I = [
    { id:'I1', label:'I1. Year Totals', title:'Clean Energy Academy — Year Totals',
      desc:'Annual workforce-development metrics with both unique and non-unique counts where applicable.',
      kind:'iYearTotals', editable:true }
  ];

  const TABLES_J = [
    { id:'J1', label:'J1. Residential Electric Usage', title:'Residential Electric Usage',
      desc:'Total kWh and per-customer averages, broken out by DAC and Non-DAC.',
      kind:'jMetric', editable:true },
    { id:'J2', label:'J2. Residential Gas Usage', title:'Residential Gas Usage',
      desc:'Total ccf and per-customer averages, broken out by DAC and Non-DAC.',
      kind:'jMetric', editable:true },
    { id:'J3', label:'J3. Unpaid 60–90 Days', title:'Unpaid Residential Accounts 60–90 Days Overdue',
      desc:'Accounts and dollar amounts overdue 60–90 days, by DAC vs Non-DAC.',
      kind:'jSegment4', editable:true },
    { id:'J4', label:'J4. Unpaid 90+ Days', title:'Unpaid Residential Accounts 90+ Days Overdue',
      desc:'Accounts and dollar amounts overdue 90 or more days, by DAC vs Non-DAC.',
      kind:'jSegment4', editable:true },
    { id:'J5', label:'J5. Disconnects & Restorations', title:'Residential Service Disconnects and Restorations',
      desc:'Disconnections for non-payment and subsequent restorations.',
      kind:'jMetric', editable:true },
    { id:'J6', label:'J6. Customers with DPAs', title:'Residential Customers with Deferred Payment Agreements',
      desc:'Customers on Deferred Payment Agreements (DPAs) and the dollar amount, by segment.',
      kind:'jSegment4', editable:true },
    { id:'J7', label:'J7. EAP Enrolled', title:'Customers Enrolled in the Energy Affordability Program',
      desc:'EAP enrollment by service type (Electric-only, Gas-only, Dual Service).',
      kind:'jEAP7', editable:true },
    { id:'J8', label:'J8. EAP Discounts', title:'Amount Expended for EAP Discounts',
      desc:'Discount dollars credited to EAP-enrolled customers, broken out by Electric and Gas.',
      kind:'jEAP8', editable:true },
    { id:'J9', label:'J9. Total Residential Customers', title:'Total Residential Customers',
      desc:'Total residential customer base by DAC vs Non-DAC.',
      kind:'jMetric', editable:true }
  ];

  const TABLES_F = [
    { id:'F1', label:'F1. Key Terms', title:'Key Terms (Definitions)',
      desc:'Glossary of distribution-system and outage-related terms used throughout the section.',
      kind:'fDescriptive', editable:true },
    { id:'F2', label:'F2. Excludable / Non-Excludable', title:'Excludable and Non-Excludable Outages Systemwide',
      desc:'Customer interruptions split by Network vs Non-Network and outage type (Excludable / Non-Excludable).',
      kind:'fOutages2', editable:true },
    { id:'F3', label:'F3. Interruption Rate', title:'Customer Interruption Rate (per 1,000 Customers Served)',
      desc:'Reliability benchmark comparing Con Edison to national/regional rates.',
      kind:'fSimple', editable:true },
    { id:'F4', label:'F4. Non-Network Areas', title:'Outages in Areas Only Supported by Non-Network',
      desc:'Outages broken down by Load Area, with Non-Excludable and Excludable counts.',
      kind:'fAreas', editable:true },
    { id:'F5', label:'F5. Network Areas', title:'Outages in Areas Only Supported by Network',
      desc:'Outages broken down by Network, with Non-Excludable and Excludable counts.',
      kind:'fAreas', editable:true },
    { id:'F6', label:'F6. Mixed Areas', title:'Outages in Areas Supported by Both Network and Non-Network',
      desc:'Outages where both system types serve the area, broken out by NN/N + Excludable/Non-Excludable.',
      kind:'fAreasMixed', editable:true },
    { id:'F7', label:'F7. Outages by DAC', title:'Excludable and Non-Excludable Outages by DAC',
      desc:'Customer interruptions by DAC vs Non-DAC by outage type.',
      kind:'fOutagesDac', editable:true },
    { id:'F8', label:'F8. Customers by Borough', title:'Percentage of Network and Non-Network Customers by Borough',
      desc:'System-wide customer counts by borough/county, by DAC vs Non-DAC.',
      kind:'fBoroughs', editable:true },
    { id:'F9', label:'F9. Interrupted by Borough', title:'Customers Interrupted by Borough',
      desc:'Customers interrupted by borough, by DAC vs Non-DAC.',
      kind:'fBoroughs', editable:true }
  ];
  const TABLES_G = [
    { id:'G1', label:'G1. System-Wide Pipe Retired', title:'Total Leak-Prone Pipe Retired',
      desc:'System-wide percentage of leak-prone pipe retired within DACs and not in DACs.',
      kind:'gPercent', editable:true },
    { id:'G2', label:'G2. Bronx Replaced', title:'Bronx County — Pipe Retired & Replaced',
      desc:'Feet of pipe replaced in Bronx County, by DAC vs Non-DAC.',
      kind:'gCounty', action:'Replaced', editable:true },
    { id:'G3', label:'G3. Bronx Abandoned ', title:'Bronx County — Pipe Retired & Abandoned',
      desc:'Feet of pipe abandoned in Bronx County',
      kind:'gCounty', action:'Abandoned', editable:true },
    { id:'G4', label:'G4. Manhattan Replaced', title:'Manhattan County — Pipe Retired & Replaced',
      desc:'Feet of pipe replaced in Manhattan County, by DAC vs Non-DAC.',
      kind:'gCounty', action:'Replaced', editable:true },
    { id:'G5', label:'G5. Manhattan Abandoned ', title:'Manhattan County — Pipe Retired & Abandoned',
      desc:'Feet of pipe abandoned in Manhattan County',
      kind:'gCounty', action:'Abandoned', editable:true },
    { id:'G6', label:'G6. Queens Replaced', title:'Queens County — Pipe Retired & Replaced',
      desc:'Feet of pipe replaced in Queens County, by DAC vs Non-DAC.',
      kind:'gCounty', action:'Replaced', editable:true },
    { id:'G7', label:'G7. Queens Abandoned ', title:'Queens County — Pipe Retired & Abandoned',
      desc:'Feet of pipe abandoned in Queens County',
      kind:'gCounty', action:'Abandoned', editable:true },
    { id:'G8', label:'G8. Westchester Replaced', title:'Westchester County — Pipe Retired & Replaced',
      desc:'Feet of pipe replaced in Westchester County, by DAC vs Non-DAC.',
      kind:'gCounty', action:'Replaced', editable:true },
    { id:'G9', label:'G9. Westchester Abandoned ', title:'Westchester County — Pipe Retired & Abandoned',
      desc:'Feet of pipe abandoned in Westchester County',
      kind:'gCounty', action:'Abandoned', editable:true },
    { id:'G10', label:'G10. Emissions Reductions', title:'Emissions Reductions (mT CH4)',
      desc:'Methane emission reductions in metric tons, by DAC vs Non-DAC.',
      kind:'gEmissions', editable:true }
  ];

  const TABLES_BY_SECTION = {
    A: TABLES_A, B: TABLES_B, C: TABLES_C, D: TABLES_D, E: TABLES_E,
    F: TABLES_F, G: TABLES_G, H: TABLES_H, I: TABLES_I, J: TABLES_J
  };

  // ============================================================
  // ROW LOOKUP — Section A (no _table tag, deduce from dims)
  // ============================================================
  function classifyRowA(row) {
    if (!row || !row.values) return null;
    const v = row.values;
    const seg = String(v.segment || '');
    const measure = String(v.measure || '').trim();
    if (measure) {
      const m = seg.match(/^(Commercial|Multifamily|Multisector|Residential)\s*\/\s*(DAC|Non-DAC)$/i);
      if (m) {
        const base = m[1];
        return base === 'Commercial' ? 'A5' : base === 'Multifamily' ? 'A6' : base === 'Multisector' ? 'A7' : 'A8';
      }
      return null;
    }
    if (/^(Residential|Multifamily|Commercial|Multisector)$/i.test(seg)) return 'A3';
    if (/^(DAC|Non-DAC)$/i.test(seg)) return 'A1A2';
    return null;
  }
  function rowsForSectionYear(section, year) {
    return loadAllRows().filter(r =>
      r.section === section && (!year || (r.values && String(r.values.year) === String(year)))
    );
  }
  function rowsForTable(tableId, year) {
    if (state.section === 'A') {
      const rs = rowsForSectionYear('A', year);
      return rs.filter(r => {
        const cls = classifyRowA(r);
        if (cls === null) return false;
        if (tableId === 'A1' || tableId === 'A2') return cls === 'A1A2';
        if (tableId === 'A3' || tableId === 'A4') return cls === 'A3';
        return cls === tableId;
      });
    }
    // B, C, D-J: use _table tag
    return rowsForSectionYear(state.section, year).filter(r => r.values && r.values._table === tableId);
  }


  // ============================================================
  // RENDERERS — Section A (preserved from v3)
  // ============================================================
  function renderA1A2(table) {
    const measureField = table.measure;
    const unit = table.unit;
    const rows = rowsForTable(table.id, state.year);
    const byProgram = {};
    rows.forEach(r => {
      const p = r.values.program || '';
      if (!byProgram[p]) byProgram[p] = { program: p, dacRow: null, nonDacRow: null };
      if (/^DAC$/i.test(r.values.segment)) byProgram[p].dacRow = r;
      else if (/^Non-DAC$/i.test(r.values.segment)) byProgram[p].nonDacRow = r;
    });

    const displayRows = Object.values(byProgram).map(g => {
      const dac = parseNumberInput(g.dacRow ? g.dacRow.values[measureField] : null);
      const nondac = parseNumberInput(g.nonDacRow ? g.nonDacRow.values[measureField] : null);
      const total = (dac == null && nondac == null) ? null : (Number(dac || 0) + Number(nondac || 0));
      return { program: g.program, total, dac, nondac, pct: total > 0 ? dac / total : null,
               dacRow: g.dacRow, nonDacRow: g.nonDacRow };
    }).sort((a, b) => (b.total || 0) - (a.total || 0));

    const gt_total = displayRows.reduce((s, r) => s + (r.total || 0), 0);
    const gt_dac = displayRows.reduce((s, r) => s + (r.dac || 0), 0);
    const gt_pct = gt_total > 0 ? gt_dac / gt_total : null;
    const fmt = unit === '$' ? fmtMoney : (v) => fmtNum(v, 0);
    const headerCells = unit === '$'
      ? '<th class="col-text">Program Name</th><th class="col-num">Total Funds Expended</th><th class="col-num">DAC Funding</th><th class="col-num">% DAC</th><th class="col-actions"></th>'
      : '<th class="col-text">Program Name</th><th class="col-num">Total ' + unit + '</th><th class="col-num">DAC ' + unit + '</th><th class="col-num">% DAC</th><th class="col-actions"></th>';

    const bodyHtml = displayRows.map((r, idx) =>
      '<tr data-idx="' + idx + '">' +
      '<td class="col-text">' + escapeHtml(r.program) + '</td>' +
      '<td class="col-num cell-edit" data-field="total" data-idx="' + idx + '" contenteditable="true">' + (r.total != null ? fmt(r.total) : '') + '</td>' +
      '<td class="col-num cell-edit" data-field="dac" data-idx="' + idx + '" contenteditable="true">' + (r.dac != null ? fmt(r.dac) : '') + '</td>' +
      '<td class="col-num cell-readonly">' + fmtPct(r.pct) + '</td>' +
      '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-idx="' + idx + '" title="Delete">×</button></td>' +
      '</tr>'
    ).join('');

    const addRowHtml =
      '<tr class="is-add-row">' +
      '<td class="col-text"><input type="text" id="add-program-name" placeholder="+ Add program..."></td>' +
      '<td class="col-num"><input type="text" id="add-program-total" placeholder="Total" inputmode="numeric"></td>' +
      '<td class="col-num"><input type="text" id="add-program-dac" placeholder="DAC" inputmode="numeric"></td>' +
      '<td class="col-num cell-readonly">—</td>' +
      '<td class="col-actions"><button class="btn-mini" id="btn-add-program-confirm">Add</button></td>' +
      '</tr>';

    const totalsRow =
      '<tr class="is-total"><td class="col-text">Grand Total</td>' +
      '<td class="col-num">' + fmt(gt_total) + '</td>' +
      '<td class="col-num">' + fmt(gt_dac) + '</td>' +
      '<td class="col-num">' + fmtPct(gt_pct) + '</td>' +
      '<td class="col-actions"></td></tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' + headerCells + '</tr></thead>' +
           '<tbody>' + bodyHtml + addRowHtml + totalsRow + '</tbody></table></div>' +
           '<div class="edit-table-help">Click any cell to edit. % DAC is computed from your edits.</div>';
  }

  function renderA3A4(table) {
    const isDac = table.isDac === true;
    const rows = rowsForTable('A3', state.year);
    const groups = {};
    rows.forEach(r => {
      const seg = r.values.segment || 'Unknown';
      if (!groups[seg]) groups[seg] = {};
      groups[seg][r.values.program || ''] = r;
    });

    const segOrder = ['Residential', 'Multifamily', 'Multisector', 'Commercial'];
    let bodyHtml = '';
    let gt_p = 0, gt_inc = 0, gt_mmbtu = 0;

    segOrder.forEach(seg => {
      const segRows = groups[seg];
      bodyHtml += '<tr class="is-subhead"><td colspan="6" class="col-text">' + seg + '</td></tr>';
      if (segRows) {
        Object.keys(segRows).sort().forEach(prog => {
          const r = segRows[prog];
          const v = r.values || {};
          const participants = parseNumberInput(v.participants);
          const inc = parseNumberInput(v.incentive_dollars);
          const mmbtu = parseNumberInput(v.energy_savings_mmbtu);
          const pVal = participants || 0;
          gt_p += pVal; gt_inc += (inc || 0); gt_mmbtu += (mmbtu || 0);

          bodyHtml +=
            '<tr><td class="col-text"></td>' +
            '<td class="col-text">' + escapeHtml(prog) + '</td>' +
            '<td class="col-num cell-edit" data-field="participants" data-rowid="' + r.id + '" contenteditable="true">' + (participants != null ? fmtNum(participants, 0) : '') + '</td>' +
            '<td class="col-num cell-edit" data-field="incentive_dollars" data-rowid="' + r.id + '" contenteditable="true">' + (inc != null ? fmtMoney(inc) : '') + '</td>' +
            '<td class="col-num cell-edit" data-field="energy_savings_mmbtu" data-rowid="' + r.id + '" contenteditable="true">' + (mmbtu != null ? fmtNum(mmbtu, 0) : '') + '</td>' +
            '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
            '</tr>';
        });
      }
      bodyHtml +=
        '<tr class="is-add-row" data-add-segment="' + seg + '">' +
        '<td class="col-text"></td>' +
        '<td class="col-text"><input type="text" class="add-prog-name" placeholder="+ Add program in ' + seg + '..."></td>' +
        '<td class="col-num"><input type="text" class="add-prog-participants" placeholder="Participants" inputmode="numeric"></td>' +
        '<td class="col-num"><input type="text" class="add-prog-inc" placeholder="Total Inc $" inputmode="numeric"></td>' +
        '<td class="col-num"><input type="text" class="add-prog-mmbtu" placeholder="Total MMBtu" inputmode="numeric"></td>' +
        '<td class="col-actions"><button class="btn-mini" data-action="add-a3" data-segment="' + seg + '">Add</button></td>' +
        '</tr>';
    });

    const gtAvgInc = gt_p > 0 ? gt_inc / gt_p : null;
    const gtAvgMmbtu = gt_p > 0 ? gt_mmbtu / gt_p : null;
    bodyHtml +=
      '<tr class="is-total">' +
      '<td class="col-text" colspan="2">Grand Total' + (isDac ? ' (DAC)' : '') + '</td>' +
      '<td class="col-num">' + fmtNum(gt_p, 0) + '</td>' +
      '<td class="col-num">' + (gtAvgInc != null ? fmtMoney(gtAvgInc) + ' avg' : '—') + '</td>' +
      '<td class="col-num">' + (gtAvgMmbtu != null ? fmtNum(gtAvgMmbtu, 1) + ' avg' : '—') + '</td>' +
      '<td class="col-actions"></td></tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Participant Type</th>' +
           '<th class="col-text">Program Name</th>' +
           '<th class="col-num">Total Participants</th>' +
           '<th class="col-num">Total Incentive $</th>' +
           '<th class="col-num">Total Energy Savings (MMBtu)</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Use the bottom row of each segment to add a new program.</div>';
  }

  function renderA5A8(table) {
    const segBase = table.segmentBase;
    const rows = rowsForTable(table.id, state.year);
    const byProg = {};
    rows.forEach(r => {
      const v = r.values || {};
      const prog = v.program || '';
      const meas = v.measure || '';
      if (!byProg[prog]) byProg[prog] = {};
      if (!byProg[prog][meas]) byProg[prog][meas] = { program: prog, measure: meas, dac: null, nondac: null, dacRow: null, nonDacRow: null };
      const installs = parseNumberInput(v.installations);
      if (/\/\s*DAC$/i.test(v.segment)) { byProg[prog][meas].dac = installs; byProg[prog][meas].dacRow = r; }
      else if (/\/\s*Non-DAC$/i.test(v.segment)) { byProg[prog][meas].nondac = installs; byProg[prog][meas].nonDacRow = r; }
    });

    let bodyHtml = '';
    let gt_total = 0, gt_dac = 0;
    Object.keys(byProg).sort().forEach(prog => {
      const measures = Object.values(byProg[prog]);
      bodyHtml += '<tr class="is-subhead"><td colspan="5" class="col-text">' + escapeHtml(prog) + '</td></tr>';
      let prog_total = 0, prog_dac = 0;
      measures.forEach(m => {
        const dac = m.dac == null ? 0 : m.dac;
        const nondac = m.nondac == null ? 0 : m.nondac;
        const total = dac + nondac;
        const totalDisplay = (m.dac == null && m.nondac == null) ? null : total;
        const pct = total > 0 ? dac / total : null;
        prog_total += total; prog_dac += dac;
        const dacRowId = m.dacRow ? m.dacRow.id : '';
        const nondacRowId = m.nonDacRow ? m.nonDacRow.id : '';
        bodyHtml +=
          '<tr>' +
          '<td class="col-text col-measure">' + escapeHtml(m.measure) + '</td>' +
          '<td class="col-num cell-edit" data-field="install_total" data-rowid="' + dacRowId + '" data-rowid-nondac="' + nondacRowId + '" data-program="' + escapeAttr(prog) + '" data-measure="' + escapeAttr(m.measure) + '" contenteditable="true">' + (totalDisplay != null ? fmtNum(total, 0) : '') + '</td>' +
          '<td class="col-num cell-edit" data-field="install_dac" data-rowid="' + dacRowId + '" data-rowid-nondac="' + nondacRowId + '" data-program="' + escapeAttr(prog) + '" data-measure="' + escapeAttr(m.measure) + '" contenteditable="true">' + (m.dac != null ? fmtNum(dac, 0) : '') + '</td>' +
          '<td class="col-num cell-readonly">' + fmtPct(pct) + '</td>' +
          '<td class="col-actions"><button class="row-delete-btn" data-action="delete-measure" data-program="' + escapeAttr(prog) + '" data-measure="' + escapeAttr(m.measure) + '" title="Delete">×</button></td>' +
          '</tr>';
      });
      const prog_pct = prog_total > 0 ? prog_dac / prog_total : null;
      bodyHtml +=
        '<tr class="is-add-row" data-add-measure-prog="' + escapeAttr(prog) + '">' +
        '<td class="col-text"><input type="text" class="add-meas-name" placeholder="+ Add measure..."></td>' +
        '<td class="col-num"><input type="text" class="add-meas-total" placeholder="Total" inputmode="numeric"></td>' +
        '<td class="col-num"><input type="text" class="add-meas-dac" placeholder="DAC" inputmode="numeric"></td>' +
        '<td class="col-num cell-readonly">—</td>' +
        '<td class="col-actions"><button class="btn-mini" data-action="add-measure" data-program="' + escapeAttr(prog) + '">Add</button></td>' +
        '</tr>';
      bodyHtml +=
        '<tr class="is-subtotal"><td class="col-text">' + escapeHtml(prog) + ' Subtotal</td>' +
        '<td class="col-num">' + fmtNum(prog_total, 0) + '</td>' +
        '<td class="col-num">' + fmtNum(prog_dac, 0) + '</td>' +
        '<td class="col-num">' + fmtPct(prog_pct) + '</td>' +
        '<td class="col-actions"></td></tr>';
      gt_total += prog_total; gt_dac += prog_dac;
    });

    bodyHtml +=
      '<tr class="is-add-row is-add-program">' +
      '<td class="col-text" colspan="2"><input type="text" id="add-a5-program" placeholder="+ Add new program..."></td>' +
      '<td class="col-num" colspan="2"></td>' +
      '<td class="col-actions"><button class="btn-mini" data-action="add-a5-program">Add Program</button></td>' +
      '</tr>';

    const gt_pct = gt_total > 0 ? gt_dac / gt_total : null;
    bodyHtml +=
      '<tr class="is-total"><td class="col-text">Grand Total</td>' +
      '<td class="col-num">' + fmtNum(gt_total, 0) + '</td>' +
      '<td class="col-num">' + fmtNum(gt_dac, 0) + '</td>' +
      '<td class="col-num">' + fmtPct(gt_pct) + '</td>' +
      '<td class="col-actions"></td></tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Program / Measure Category</th>' +
           '<th class="col-num">Total Installations</th>' +
           '<th class="col-num">DAC Installations</th>' +
           '<th class="col-num">% DAC</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Use "Add measure" inside a program, or "Add Program" at the bottom. Segment: ' + segBase + '.</div>';
  }

  function renderA9() {
    function totals(year, measure) {
      const rs = loadAllRows().filter(r =>
        r.section === 'A' && r.values && String(r.values.year) === String(year) && classifyRowA(r) === 'A1A2');
      let total = 0, dac = 0;
      rs.forEach(r => {
        const v = parseNumberInput(r.values[measure]) || 0;
        total += v;
        if (/^DAC$/i.test(r.values.segment)) dac += v;
      });
      return { total, dac, pct: total > 0 ? dac / total : null };
    }
    const years = getAvailableYears('A');
    const cur = state.year;
    const prev = years.find(y => y !== cur) || null;
    const inc_cur = totals(cur, 'incentive_dollars');
    const inc_prev = prev ? totals(prev, 'incentive_dollars') : null;
    const mm_cur = totals(cur, 'energy_savings_mmbtu');
    const mm_prev = prev ? totals(prev, 'energy_savings_mmbtu') : null;
    const deltaPct = (a, b) => (b > 0) ? ((a - b) / b) * 100 : null;
    const renderRow = (label, a, b, fmt) => {
      const d = b == null ? null : deltaPct(a, b);
      const dStr = d == null ? '—' : (d >= 0 ? '↑ ' : '↓ ') + Math.abs(d).toFixed(1) + '%';
      const dCls = d == null ? '' : (d >= 0 ? 'up' : 'down');
      return '<tr><td class="col-text">' + label + '</td>' +
             '<td class="col-num">' + fmt(a) + '</td>' +
             '<td class="col-num">' + (b != null ? fmt(b) : '—') + '</td>' +
             '<td class="col-num delta ' + dCls + '">' + dStr + '</td></tr>';
    };
    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Metric</th>' +
           '<th class="col-num">' + cur + '</th>' +
           '<th class="col-num">' + (prev || 'no prior year') + '</th>' +
           '<th class="col-num">Δ YoY</th>' +
           '</tr></thead><tbody>' +
           renderRow('Total Incentives ($)', inc_cur.total, inc_prev ? inc_prev.total : null, fmtMoney) +
           renderRow('DAC Incentives ($)', inc_cur.dac, inc_prev ? inc_prev.dac : null, fmtMoney) +
           renderRow('% DAC of Incentives', (inc_cur.pct || 0) * 100, inc_prev ? (inc_prev.pct || 0) * 100 : null, v => v.toFixed(1) + '%') +
           renderRow('Total Energy Savings (MMBtu)', mm_cur.total, mm_prev ? mm_prev.total : null, v => fmtNum(v, 0)) +
           renderRow('DAC Energy Savings (MMBtu)', mm_cur.dac, mm_prev ? mm_prev.dac : null, v => fmtNum(v, 0)) +
           renderRow('% DAC of Energy Savings', (mm_cur.pct || 0) * 100, mm_prev ? (mm_prev.pct || 0) * 100 : null, v => v.toFixed(1) + '%') +
           '</tbody></table></div>' +
           '<div class="edit-table-help">Read-only. Aggregated from A1 + A2 across years.</div>';
  }

  function renderA10() {
    function totalsForSeg(year, segBase) {
      const rs = loadAllRows().filter(r =>
        r.section === 'A' && r.values && String(r.values.year) === String(year) &&
        r.values.measure && new RegExp('^' + segBase + '\\s*\\/').test(r.values.segment || ''));
      let total = 0, dac = 0;
      rs.forEach(r => {
        const v = parseNumberInput(r.values.installations) || 0;
        total += v;
        if (/\/\s*DAC$/i.test(r.values.segment)) dac += v;
      });
      return { total, dac };
    }
    const years = getAvailableYears('A');
    const cur = state.year;
    const prev = years.find(y => y !== cur) || null;
    const segments = ['Commercial', 'Multifamily', 'Multisector', 'Residential'];
    let body = '';
    let gt_cur = 0, gt_prev = 0, gtDac_cur = 0, gtDac_prev = 0;
    segments.forEach(seg => {
      const a = totalsForSeg(cur, seg);
      const b = prev ? totalsForSeg(prev, seg) : { total: 0, dac: 0 };
      gt_cur += a.total; gtDac_cur += a.dac;
      if (prev) { gt_prev += b.total; gtDac_prev += b.dac; }
      const d = (prev && b.total > 0) ? ((a.total - b.total) / b.total) * 100 : null;
      const dStr = d == null ? '—' : (d >= 0 ? '↑ ' : '↓ ') + Math.abs(d).toFixed(1) + '%';
      const dCls = d == null ? '' : (d >= 0 ? 'up' : 'down');
      body += '<tr><td class="col-text">' + seg + '</td>' +
              '<td class="col-num">' + fmtNum(a.total, 0) + '</td>' +
              '<td class="col-num">' + fmtNum(a.dac, 0) + '</td>' +
              '<td class="col-num">' + (prev ? fmtNum(b.total, 0) : '—') + '</td>' +
              '<td class="col-num">' + (prev ? fmtNum(b.dac, 0) : '—') + '</td>' +
              '<td class="col-num delta ' + dCls + '">' + dStr + '</td></tr>';
    });
    const dGt = (prev && gt_prev > 0) ? ((gt_cur - gt_prev) / gt_prev) * 100 : null;
    const dGtStr = dGt == null ? '—' : (dGt >= 0 ? '↑ ' : '↓ ') + Math.abs(dGt).toFixed(1) + '%';
    body += '<tr class="is-total"><td class="col-text">Grand Total</td>' +
            '<td class="col-num">' + fmtNum(gt_cur, 0) + '</td>' +
            '<td class="col-num">' + fmtNum(gtDac_cur, 0) + '</td>' +
            '<td class="col-num">' + (prev ? fmtNum(gt_prev, 0) : '—') + '</td>' +
            '<td class="col-num">' + (prev ? fmtNum(gtDac_prev, 0) : '—') + '</td>' +
            '<td class="col-num delta ' + (dGt == null ? '' : (dGt >= 0 ? 'up' : 'down')) + '">' + dGtStr + '</td></tr>';
    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text" rowspan="2">Customer Segment</th>' +
           '<th class="col-num" colspan="2">' + cur + '</th>' +
           '<th class="col-num" colspan="2">' + (prev || 'no prior year') + '</th>' +
           '<th class="col-num" rowspan="2">Δ Total YoY</th>' +
           '</tr><tr>' +
           '<th class="col-num">Total Installs</th>' +
           '<th class="col-num">DAC Installs</th>' +
           '<th class="col-num">Total Installs</th>' +
           '<th class="col-num">DAC Installs</th>' +
           '</tr></thead><tbody>' + body + '</tbody></table></div>' +
           '<div class="edit-table-help">Read-only. Aggregated from A5–A8 across years.</div>';
  }

  // ============================================================
  // RENDERERS — Section B
  // ============================================================
  function renderB1(table) {
    // Three rows: DAC, Non-DAC, Total — each with funding_dollars
    const segments = ['DAC', 'Non-DAC', 'Total'];
    const rows = rowsForTable('B1', state.year);
    const bySeg = {};
    rows.forEach(r => { bySeg[r.values.segment] = r; });

    let bodyHtml = '';
    segments.forEach(seg => {
      const r = bySeg[seg];
      const v = r ? parseNumberInput(r.values.funding_dollars) : null;
      const rowid = r ? r.id : '';
      bodyHtml +=
        '<tr>' +
        '<td class="col-text">' + seg + '</td>' +
        '<td class="col-num cell-edit" data-field="funding_dollars" data-rowid="' + rowid + '" data-segment="' + seg + '" contenteditable="true">' + (v != null ? fmtMoney(v) : '') + '</td>' +
        '<td class="col-actions"></td>' +
        '</tr>';
    });

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Category</th>' +
           '<th class="col-num">Incentive Funding ($)</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Edit funding amounts directly. The total is what was reported, not a derived sum.</div>';
  }

  function renderB2(table) {
    // Three rows × {L2, DCFC, Total}
    const segments = ['DAC', 'Non-DAC', 'Total'];
    const rows = rowsForTable('B2', state.year);
    // Build grid: { 'DAC|L2': row, 'DAC|DCFC': row, ... }
    const grid = {};
    rows.forEach(r => {
      const k = r.values.segment + '|' + r.values.charger_type;
      grid[k] = r;
    });

    let bodyHtml = '';
    segments.forEach(seg => {
      const l2Row = grid[seg + '|L2'];
      const dcfcRow = grid[seg + '|DCFC'];
      const l2Val = l2Row ? parseNumberInput(l2Row.values.plugs) : null;
      const dcfcVal = dcfcRow ? parseNumberInput(dcfcRow.values.plugs) : null;
      const totalVal = ((l2Val || 0) + (dcfcVal || 0));

      bodyHtml +=
        '<tr>' +
        '<td class="col-text">' + seg + '</td>' +
        '<td class="col-num cell-edit" data-field="plugs" data-rowid="' + (l2Row ? l2Row.id : '') + '" data-segment="' + seg + '" data-charger="L2" contenteditable="true">' + (l2Val != null ? fmtNum(l2Val, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="plugs" data-rowid="' + (dcfcRow ? dcfcRow.id : '') + '" data-segment="' + seg + '" data-charger="DCFC" contenteditable="true">' + (dcfcVal != null ? fmtNum(dcfcVal, 0) : '') + '</td>' +
        '<td class="col-num cell-readonly">' + fmtNum(totalVal, 0) + '</td>' +
        '<td class="col-actions"></td>' +
        '</tr>';
    });

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Category</th>' +
           '<th class="col-num">L2 Plugs</th>' +
           '<th class="col-num">DCFC Plugs</th>' +
           '<th class="col-num">Total Plugs</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Total Plugs is computed as L2 + DCFC.</div>';
  }

  // ============================================================
  // RENDERERS — Section C
  // ============================================================
  function renderC1(table) {
    const rows = rowsForTable('C1', state.year);
    let bodyHtml = '';
    rows.forEach(r => {
      const v = r.values || {};
      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="program" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.program || '') + '</td>' +
        '<td class="col-text cell-edit" data-field="category" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.category || '') + '</td>' +
        '<td class="col-text cell-edit" data-field="description" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.description || '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });
    bodyHtml +=
      '<tr class="is-add-row">' +
      '<td class="col-text"><input type="text" class="add-c1-program" placeholder="+ Add program..."></td>' +
      '<td class="col-text"><input type="text" class="add-c1-category" placeholder="Category"></td>' +
      '<td class="col-text"><input type="text" class="add-c1-description" placeholder="Description"></td>' +
      '<td class="col-actions"><button class="btn-mini" data-action="add-c1">Add</button></td>' +
      '</tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table is-definitions has-4-cols">' +
           '<thead><tr>' +
           '<th class="col-text">Program</th>' +
           '<th class="col-text">Category</th>' +
           '<th class="col-text">Description</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">All fields are free text. Click any cell to edit.</div>';
  }

  function renderC2(table) {
    // Customer Group × {Participants, Committed MW, Avg Event MW}
    // Standard groups: DAC, Low-Income, Total
    const groups = ['DAC', 'Low-Income', 'Total'];
    const rows = rowsForTable('C2', state.year);
    const bySeg = {};
    rows.forEach(r => { bySeg[r.values.segment] = r; });

    let bodyHtml = '';
    groups.forEach(grp => {
      const r = bySeg[grp];
      const v = r ? r.values : {};
      const part = parseNumberInput(v.participants);
      const comm = parseNumberInput(v.committed_mw);
      const avg = parseNumberInput(v.avg_event_mw);
      const rowid = r ? r.id : '';
      bodyHtml +=
        '<tr>' +
        '<td class="col-text">' + grp + '</td>' +
        '<td class="col-num cell-edit" data-field="participants" data-rowid="' + rowid + '" data-segment="' + grp + '" contenteditable="true">' + (part != null ? fmtNum(part, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="committed_mw" data-rowid="' + rowid + '" data-segment="' + grp + '" contenteditable="true">' + (comm != null ? fmtNum(comm, 2) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="avg_event_mw" data-rowid="' + rowid + '" data-segment="' + grp + '" contenteditable="true">' + (avg != null ? fmtNum(avg, 2) : '') + '</td>' +
        '<td class="col-actions"></td>' +
        '</tr>';
    });

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Customer Group</th>' +
           '<th class="col-num">Participants</th>' +
           '<th class="col-num">Committed Load Relief (MW)</th>' +
           '<th class="col-num">Avg Event Reductions (MW)</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Edit each cell directly. Values are reported, not derived.</div>';
  }

  function renderCProgram(table) {
    // Program × {Participants, Committed MW, Delivered MW}, segment fixed
    const segment = table.segment;
    const rows = rowsForTable(table.id, state.year);

    let bodyHtml = '';
    let totParts = 0, totComm = 0, totDeliv = 0;
    rows.forEach(r => {
      const v = r.values || {};
      const prog = v.program || '';
      const part = parseNumberInput(v.participants);
      const comm = parseNumberInput(v.committed_mw);
      const deliv = parseNumberInput(v.delivered_mw);
      totParts += (part || 0);
      totComm += (comm || 0);
      totDeliv += (deliv || 0);
      bodyHtml +=
        '<tr>' +
        '<td class="col-text">' + escapeHtml(prog) + '</td>' +
        '<td class="col-num cell-edit" data-field="participants" data-rowid="' + r.id + '" contenteditable="true">' + (part != null ? fmtNum(part, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="committed_mw" data-rowid="' + r.id + '" contenteditable="true">' + (comm != null ? fmtNum(comm, 2) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="delivered_mw" data-rowid="' + r.id + '" contenteditable="true">' + (deliv != null ? fmtNum(deliv, 2) : '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });

    bodyHtml +=
      '<tr class="is-add-row">' +
      '<td class="col-text"><input type="text" class="add-cprog-name" placeholder="+ Add program..."></td>' +
      '<td class="col-num"><input type="text" class="add-cprog-part" placeholder="Participants" inputmode="numeric"></td>' +
      '<td class="col-num"><input type="text" class="add-cprog-comm" placeholder="Comm MW" inputmode="numeric"></td>' +
      '<td class="col-num"><input type="text" class="add-cprog-deliv" placeholder="Deliv MW" inputmode="numeric"></td>' +
      '<td class="col-actions"><button class="btn-mini" data-action="add-cprog" data-table="' + table.id + '" data-segment="' + segment + '">Add</button></td>' +
      '</tr>';

    bodyHtml +=
      '<tr class="is-total"><td class="col-text">Total</td>' +
      '<td class="col-num">' + fmtNum(totParts, 0) + '</td>' +
      '<td class="col-num">' + fmtNum(totComm, 2) + '</td>' +
      '<td class="col-num">' + fmtNum(totDeliv, 2) + '</td>' +
      '<td class="col-actions"></td></tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Program Name</th>' +
           '<th class="col-num">Program Participants</th>' +
           '<th class="col-num">Committed Load Relief (MW)</th>' +
           '<th class="col-num">Delivered Load Relief (MW)</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Customer segment: ' + segment + '. Edit any cell or add a new program at the bottom.</div>';
  }

  // ============================================================
  // RENDERERS — Section D
  // ============================================================
  function renderD1(table) {
    const rows = rowsForTable('D1', state.year);
    let bodyHtml = '';
    rows.forEach(r => {
      const v = r.values || {};
      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="compensation_type" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.compensation_type || '') + '</td>' +
        '<td class="col-text cell-edit" data-field="description" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.description || '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });
    bodyHtml +=
      '<tr class="is-add-row">' +
      '<td class="col-text"><input type="text" class="add-d1-type" placeholder="+ Add compensation type..."></td>' +
      '<td class="col-text"><input type="text" class="add-d1-description" placeholder="Description"></td>' +
      '<td class="col-actions"><button class="btn-mini" data-action="add-d1">Add</button></td>' +
      '</tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table is-definitions has-3-cols">' +
           '<thead><tr>' +
           '<th class="col-text">Compensation Type</th>' +
           '<th class="col-text">Description</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Both fields are free text. Click any cell to edit.</div>';
  }

  function renderDCumulative(table) {
    // Metric × {Cumulative through year, Current year}
    const metrics = table.metrics;
    const rows = rowsForTable(table.id, state.year);
    const byMetric = {};
    rows.forEach(r => { byMetric[r.values.metric] = r; });

    let bodyHtml = '';
    metrics.forEach(metric => {
      const r = byMetric[metric];
      const v = r ? r.values : {};
      const cum = parseNumberInput(v.cumulative);
      const cur = parseNumberInput(v.current_year);
      const isPct = /^percent/i.test(metric);
      const fmt = isPct ? (x) => x != null ? (x * 100).toFixed(1) + '%' : '' : (x) => x != null ? fmtNum(x, 2) : '';
      const rowid = r ? r.id : '';

      bodyHtml +=
        '<tr>' +
        '<td class="col-text">' + escapeHtml(metric) + '</td>' +
        '<td class="col-num cell-edit" data-field="cumulative" data-rowid="' + rowid + '" data-metric="' + escapeAttr(metric) + '" data-table="' + table.id + '" data-pct="' + (isPct ? '1' : '0') + '" contenteditable="true">' + fmt(cum) + '</td>' +
        '<td class="col-num cell-edit" data-field="current_year" data-rowid="' + rowid + '" data-metric="' + escapeAttr(metric) + '" data-table="' + table.id + '" data-pct="' + (isPct ? '1' : '0') + '" contenteditable="true">' + fmt(cur) + '</td>' +
        '<td class="col-actions"></td>' +
        '</tr>';
    });

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Metric</th>' +
           '<th class="col-num">Cumulative through ' + state.year + '</th>' +
           '<th class="col-num">' + state.year + '</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Cumulative is the total accumulated up to and including the reporting year. Percentages are entered as decimals (e.g., 0.32 for 32%) or as percentages (32) — both work.</div>';
  }

  // ============================================================
  // RENDERERS — Section E
  // ============================================================
  function renderE1(table) {
    const rows = rowsForTable('E1', state.year);
    let bodyHtml = '';
    let gtTotal = 0;
    let gtDacAffected = 0;  // sum of (total * pct)

    rows.forEach(r => {
      const v = r.values || {};
      const cat = v.category || '';
      const total = parseNumberInput(v.total_investment);
      const pct = parseNumberInput(v.pct_affecting_dacs);
      gtTotal += (total || 0);
      gtDacAffected += ((total || 0) * (pct || 0));

      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="category" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(cat) + '</td>' +
        '<td class="col-num cell-edit" data-field="total_investment" data-rowid="' + r.id + '" contenteditable="true">' + (total != null ? fmtMoney(total) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="pct_affecting_dacs" data-rowid="' + r.id + '" contenteditable="true">' + (pct != null ? (pct * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });

    bodyHtml +=
      '<tr class="is-add-row">' +
      '<td class="col-text"><input type="text" class="add-e1-category" placeholder="+ Add category..."></td>' +
      '<td class="col-num"><input type="text" class="add-e1-total" placeholder="Total Investment $" inputmode="numeric"></td>' +
      '<td class="col-num"><input type="text" class="add-e1-pct" placeholder="% (e.g. 50 or 0.5)" inputmode="numeric"></td>' +
      '<td class="col-actions"><button class="btn-mini" data-action="add-e1">Add</button></td>' +
      '</tr>';

    const gtPct = gtTotal > 0 ? gtDacAffected / gtTotal : null;
    bodyHtml +=
      '<tr class="is-total">' +
      '<td class="col-text">Grand Total</td>' +
      '<td class="col-num">' + fmtMoney(gtTotal) + '</td>' +
      '<td class="col-num">' + fmtPct(gtPct) + '</td>' +
      '<td class="col-actions"></td>' +
      '</tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Investment Category</th>' +
           '<th class="col-num">Total Investment ($)</th>' +
           '<th class="col-num">% Affecting DACs</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Percentages can be entered as decimal (0.53) or whole (53). Grand Total % is weighted by spend.</div>';
  }

  // ============================================================
  // RENDERERS — Section H (Leak Repairs)
  // ============================================================
  function renderH1(table) {
    // Standard boroughs we expect (in display order)
    const boroughs = ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island', 'Westchester'];
    const rows = rowsForTable('H1', state.year);
    const byBorough = {};
    rows.forEach(r => { byBorough[r.values.borough] = r; });

    // Display whatever boroughs exist (existing first, then add any that aren't in the standard list)
    const displayList = [];
    boroughs.forEach(b => { if (byBorough[b]) displayList.push(b); });
    Object.keys(byBorough).forEach(b => { if (!displayList.includes(b)) displayList.push(b); });

    let bodyHtml = '';
    let gtNonDac = 0, gtDac = 0;
    displayList.forEach(b => {
      const r = byBorough[b];
      const v = r ? r.values : {};
      const nd = parseNumberInput(v.non_dac_repairs);
      const d = parseNumberInput(v.dac_repairs);
      const total = (nd != null || d != null) ? (Number(nd || 0) + Number(d || 0)) : null;
      gtNonDac += (nd || 0);
      gtDac += (d || 0);
      const rowid = r ? r.id : '';
      bodyHtml +=
        '<tr>' +
        '<td class="col-text">' + escapeHtml(b) + '</td>' +
        '<td class="col-num cell-edit" data-field="non_dac_repairs" data-rowid="' + rowid + '" data-borough="' + escapeAttr(b) + '" contenteditable="true">' + (nd != null ? fmtNum(nd, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="dac_repairs" data-rowid="' + rowid + '" data-borough="' + escapeAttr(b) + '" contenteditable="true">' + (d != null ? fmtNum(d, 0) : '') + '</td>' +
        '<td class="col-num cell-readonly">' + (total != null ? fmtNum(total, 0) : '—') + '</td>' +
        '<td class="col-actions">' + (rowid ? '<button class="row-delete-btn" data-action="delete-row" data-rowid="' + rowid + '" title="Delete">×</button>' : '') + '</td>' +
        '</tr>';
    });

    // Add row inline
    bodyHtml +=
      '<tr class="is-add-row">' +
      '<td class="col-text"><input type="text" class="add-h1-borough" placeholder="+ Add borough/county..."></td>' +
      '<td class="col-num"><input type="text" class="add-h1-nondac" placeholder="Non-DAC" inputmode="numeric"></td>' +
      '<td class="col-num"><input type="text" class="add-h1-dac" placeholder="DAC" inputmode="numeric"></td>' +
      '<td class="col-num cell-readonly">—</td>' +
      '<td class="col-actions"><button class="btn-mini" data-action="add-h1">Add</button></td>' +
      '</tr>';

    bodyHtml +=
      '<tr class="is-total">' +
      '<td class="col-text">Grand Total</td>' +
      '<td class="col-num">' + fmtNum(gtNonDac, 0) + '</td>' +
      '<td class="col-num">' + fmtNum(gtDac, 0) + '</td>' +
      '<td class="col-num">' + fmtNum(gtNonDac + gtDac, 0) + '</td>' +
      '<td class="col-actions"></td>' +
      '</tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Borough / County</th>' +
           '<th class="col-num">Non-DAC Repairs</th>' +
           '<th class="col-num">DAC Repairs</th>' +
           '<th class="col-num">Grand Total</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Grand Total per row is computed as Non-DAC + DAC.</div>';
  }

  // ============================================================
  // RENDERERS — Section I (Clean Energy Jobs)
  // ============================================================
  function renderI1(table) {
    // Metric × {Unique, Non-Unique} — values can be numeric or text
    const rows = rowsForTable('I1', state.year);

    let bodyHtml = '';
    rows.forEach(r => {
      const v = r.values || {};
      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="metric" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.metric || '') + '</td>' +
        '<td class="col-text cell-edit" data-field="unique" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.unique || '') + '</td>' +
        '<td class="col-text cell-edit" data-field="non_unique" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.non_unique || '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });

    // Add row inline
    bodyHtml +=
      '<tr class="is-add-row">' +
      '<td class="col-text"><input type="text" class="add-i1-metric" placeholder="+ Add metric..."></td>' +
      '<td class="col-text"><input type="text" class="add-i1-unique" placeholder="Unique value"></td>' +
      '<td class="col-text"><input type="text" class="add-i1-nonunique" placeholder="Non-Unique value"></td>' +
      '<td class="col-actions"><button class="btn-mini" data-action="add-i1">Add</button></td>' +
      '</tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table is-definitions has-4-cols">' +
           '<thead><tr>' +
           '<th class="col-text">Metric</th>' +
           '<th class="col-text">Unique</th>' +
           '<th class="col-text">Non-Unique</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">All cells are free text. "Unique" counts distinct individuals; "Non-Unique" counts events. Some cells are descriptive text rather than numbers.</div>';
  }

  // ============================================================
  // RENDERERS — Section J (Customer Operations)
  // ============================================================

  // jMetric: Metric × {DAC value, DAC %, Non-DAC value, Non-DAC %}
  // Used by J1, J2, J5, J9
  function renderJMetric(table) {
    const rows = rowsForTable(table.id, state.year);
    let bodyHtml = '';

    rows.forEach(r => {
      const v = r.values || {};
      // J9 uses 'metric' field (we normalized) — same as J1/J2/J5
      const metricLabel = v.metric || '';
      const dacV = parseNumberInput(v.dac_value);
      const dacP = parseNumberInput(v.dac_pct);
      const ndV = parseNumberInput(v.nondac_value);
      const ndP = parseNumberInput(v.nondac_pct);

      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="metric" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(metricLabel) + '</td>' +
        '<td class="col-num cell-edit" data-field="dac_value" data-rowid="' + r.id + '" contenteditable="true">' + (dacV != null ? fmtNum(dacV, 2) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="dac_pct" data-rowid="' + r.id + '" data-pct="1" contenteditable="true">' + (dacP != null ? (dacP * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="nondac_value" data-rowid="' + r.id + '" contenteditable="true">' + (ndV != null ? fmtNum(ndV, 2) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="nondac_pct" data-rowid="' + r.id + '" data-pct="1" contenteditable="true">' + (ndP != null ? (ndP * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });

    // Add row inline
    bodyHtml +=
      '<tr class="is-add-row">' +
      '<td class="col-text"><input type="text" class="add-jm-metric" placeholder="+ Add metric..."></td>' +
      '<td class="col-num"><input type="text" class="add-jm-dacv" placeholder="DAC" inputmode="numeric"></td>' +
      '<td class="col-num"><input type="text" class="add-jm-dacp" placeholder="DAC %" inputmode="numeric"></td>' +
      '<td class="col-num"><input type="text" class="add-jm-ndv" placeholder="Non-DAC" inputmode="numeric"></td>' +
      '<td class="col-num"><input type="text" class="add-jm-ndp" placeholder="Non-DAC %" inputmode="numeric"></td>' +
      '<td class="col-actions"><button class="btn-mini" data-action="add-jmetric" data-table="' + table.id + '">Add</button></td>' +
      '</tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Metric</th>' +
           '<th class="col-num">DAC</th>' +
           '<th class="col-num">DAC % of Total</th>' +
           '<th class="col-num">Non-DAC</th>' +
           '<th class="col-num">Non-DAC % of Total</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Percentages can be entered as decimal (0.40) or whole (40). Some metrics (averages) may have N/A in the % columns — leave them blank.</div>';
  }

  // jSegment4: Segment (DAC/Non-DAC) × {Accounts, %Acc, Amount, %Amt}
  // Used by J3, J4, J6
  function renderJSegment4(table) {
    const segments = ['DAC', 'Non-DAC'];
    const rows = rowsForTable(table.id, state.year);
    const bySeg = {};
    rows.forEach(r => { bySeg[r.values.segment] = r; });

    let bodyHtml = '';
    let gtAccounts = 0, gtAmount = 0;
    segments.forEach(seg => {
      const r = bySeg[seg];
      const v = r ? r.values : {};
      const acc = parseNumberInput(v.accounts);
      const accP = parseNumberInput(v.accounts_pct);
      const amt = parseNumberInput(v.amount);
      const amtP = parseNumberInput(v.amount_pct);
      gtAccounts += (acc || 0);
      gtAmount += (amt || 0);
      const rowid = r ? r.id : '';
      bodyHtml +=
        '<tr>' +
        '<td class="col-text">Total in ' + seg + '</td>' +
        '<td class="col-num cell-edit" data-field="accounts" data-rowid="' + rowid + '" data-segment="' + seg + '" data-table="' + table.id + '" contenteditable="true">' + (acc != null ? fmtNum(acc, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="accounts_pct" data-rowid="' + rowid + '" data-segment="' + seg + '" data-table="' + table.id + '" data-pct="1" contenteditable="true">' + (accP != null ? (accP * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="amount" data-rowid="' + rowid + '" data-segment="' + seg + '" data-table="' + table.id + '" contenteditable="true">' + (amt != null ? fmtMoney(amt) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="amount_pct" data-rowid="' + rowid + '" data-segment="' + seg + '" data-table="' + table.id + '" data-pct="1" contenteditable="true">' + (amtP != null ? (amtP * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-actions"></td>' +
        '</tr>';
    });

    // Grand Total
    bodyHtml +=
      '<tr class="is-total">' +
      '<td class="col-text">Grand Total</td>' +
      '<td class="col-num">' + fmtNum(gtAccounts, 0) + '</td>' +
      '<td class="col-num">100%</td>' +
      '<td class="col-num">' + fmtMoney(gtAmount) + '</td>' +
      '<td class="col-num">100%</td>' +
      '<td class="col-actions"></td>' +
      '</tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Category</th>' +
           '<th class="col-num">Total Accounts</th>' +
           '<th class="col-num">% of Accounts</th>' +
           '<th class="col-num">Total Amount</th>' +
           '<th class="col-num">% of Amount</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Edit any cell. Percentages can be entered as decimal (0.64) or whole (64).</div>';
  }

  // jEAP7: Segment × {Electric-only, Gas-only, Dual Service, % of Accounts}
  function renderJEAP7(table) {
    const segments = ['DAC', 'Non-DAC'];
    const rows = rowsForTable('J7', state.year);
    const bySeg = {};
    rows.forEach(r => { bySeg[r.values.segment] = r; });

    let bodyHtml = '';
    let gtElec = 0, gtGas = 0, gtDual = 0;
    segments.forEach(seg => {
      const r = bySeg[seg];
      const v = r ? r.values : {};
      const elec = parseNumberInput(v.electric_only);
      const gas = parseNumberInput(v.gas_only);
      const dual = parseNumberInput(v.dual_service);
      const accP = parseNumberInput(v.accounts_pct);
      gtElec += (elec || 0); gtGas += (gas || 0); gtDual += (dual || 0);
      const rowid = r ? r.id : '';
      bodyHtml +=
        '<tr>' +
        '<td class="col-text">Total in ' + seg + '</td>' +
        '<td class="col-num cell-edit" data-field="electric_only" data-rowid="' + rowid + '" data-segment="' + seg + '" contenteditable="true">' + (elec != null ? fmtNum(elec, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="gas_only" data-rowid="' + rowid + '" data-segment="' + seg + '" contenteditable="true">' + (gas != null ? fmtNum(gas, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="dual_service" data-rowid="' + rowid + '" data-segment="' + seg + '" contenteditable="true">' + (dual != null ? fmtNum(dual, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="accounts_pct" data-rowid="' + rowid + '" data-segment="' + seg + '" data-pct="1" contenteditable="true">' + (accP != null ? (accP * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-actions"></td>' +
        '</tr>';
    });

    bodyHtml +=
      '<tr class="is-total">' +
      '<td class="col-text">Grand Total</td>' +
      '<td class="col-num">' + fmtNum(gtElec, 0) + '</td>' +
      '<td class="col-num">' + fmtNum(gtGas, 0) + '</td>' +
      '<td class="col-num">' + fmtNum(gtDual, 0) + '</td>' +
      '<td class="col-num">100%</td>' +
      '<td class="col-actions"></td>' +
      '</tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Category</th>' +
           '<th class="col-num">Electric-only</th>' +
           '<th class="col-num">Gas-only</th>' +
           '<th class="col-num">Dual Service</th>' +
           '<th class="col-num">% of Accounts</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">EAP enrollment counted by service type. Total customers in DAC = Electric + Gas + Dual.</div>';
  }

  // jEAP8: Segment × {Electric, Gas, % of Total}
  function renderJEAP8(table) {
    const segments = ['DAC', 'Non-DAC'];
    const rows = rowsForTable('J8', state.year);
    const bySeg = {};
    rows.forEach(r => { bySeg[r.values.segment] = r; });

    let bodyHtml = '';
    let gtElec = 0, gtGas = 0;
    segments.forEach(seg => {
      const r = bySeg[seg];
      const v = r ? r.values : {};
      const elec = parseNumberInput(v.electric);
      const gas = parseNumberInput(v.gas);
      const amtP = parseNumberInput(v.amount_pct);
      gtElec += (elec || 0); gtGas += (gas || 0);
      const rowid = r ? r.id : '';
      bodyHtml +=
        '<tr>' +
        '<td class="col-text">Total in ' + seg + '</td>' +
        '<td class="col-num cell-edit" data-field="electric" data-rowid="' + rowid + '" data-segment="' + seg + '" contenteditable="true">' + (elec != null ? fmtMoney(elec) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="gas" data-rowid="' + rowid + '" data-segment="' + seg + '" contenteditable="true">' + (gas != null ? fmtMoney(gas) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="amount_pct" data-rowid="' + rowid + '" data-segment="' + seg + '" data-pct="1" contenteditable="true">' + (amtP != null ? (amtP * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-actions"></td>' +
        '</tr>';
    });

    bodyHtml +=
      '<tr class="is-total">' +
      '<td class="col-text">Grand Total</td>' +
      '<td class="col-num">' + fmtMoney(gtElec) + '</td>' +
      '<td class="col-num">' + fmtMoney(gtGas) + '</td>' +
      '<td class="col-num">100%</td>' +
      '<td class="col-actions"></td>' +
      '</tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table">' +
           '<thead><tr>' +
           '<th class="col-text">Category</th>' +
           '<th class="col-num">Electric ($)</th>' +
           '<th class="col-num">Gas ($)</th>' +
           '<th class="col-num">% of Total</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Dollar amounts of EAP discount delivered to enrolled customers, by service type.</div>';
  }

  // ============================================================
  // RENDERERS — Section F (Customer Outages)
  // ============================================================

  // F1: Term + Description (descriptive, 3 cols incl Actions)
  function renderF1(table) {
    const rows = rowsForTable('F1', state.year);
    let bodyHtml = '';
    rows.forEach(r => {
      const v = r.values || {};
      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="term" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.term || '') + '</td>' +
        '<td class="col-text cell-edit" data-field="description" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.description || '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });
    bodyHtml +=
      '<tr class="is-add-row">' +
      '<td class="col-text"><input type="text" class="add-f1-term" placeholder="+ Add term..."></td>' +
      '<td class="col-text"><input type="text" class="add-f1-description" placeholder="Description"></td>' +
      '<td class="col-actions"><button class="btn-mini" data-action="add-f1">Add</button></td>' +
      '</tr>';
    return '<div class="ingest-table-wrap"><table class="data-table edit-table is-definitions has-3-cols">' +
           '<thead><tr><th class="col-text">Term</th><th class="col-text">Description</th><th class="col-actions"></th></tr></thead>' +
           '<tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Glossary of terms used in Section F.</div>';
  }

  // F2: Outage Type × {Network, Network%, Non-Network, Non-Network%}
  function renderF2(table) {
    const types = ['Non-Excludable', 'Excludable'];
    const rows = rowsForTable('F2', state.year);
    const byType = {};
    rows.forEach(r => { byType[r.values.outage_type] = r; });

    let bodyHtml = '';
    let gtNet = 0, gtNonNet = 0;
    types.forEach(t => {
      const r = byType[t];
      const v = r ? r.values : {};
      const net = parseNumberInput(v.network);
      const netP = parseNumberInput(v.network_pct);
      const nn = parseNumberInput(v.non_network);
      const nnP = parseNumberInput(v.non_network_pct);
      gtNet += (net || 0); gtNonNet += (nn || 0);
      const rowid = r ? r.id : '';
      bodyHtml +=
        '<tr>' +
        '<td class="col-text">' + t + '</td>' +
        '<td class="col-num cell-edit" data-field="network" data-rowid="' + rowid + '" data-type="' + t + '" contenteditable="true">' + (net != null ? fmtNum(net, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="network_pct" data-rowid="' + rowid + '" data-type="' + t + '" data-pct="1" contenteditable="true">' + (netP != null ? (netP * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="non_network" data-rowid="' + rowid + '" data-type="' + t + '" contenteditable="true">' + (nn != null ? fmtNum(nn, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="non_network_pct" data-rowid="' + rowid + '" data-type="' + t + '" data-pct="1" contenteditable="true">' + (nnP != null ? (nnP * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-num cell-readonly">' + fmtNum((net || 0) + (nn || 0), 0) + '</td>' +
        '</tr>';
    });
    bodyHtml += '<tr class="is-total"><td class="col-text">Grand Total</td>' +
                '<td class="col-num">' + fmtNum(gtNet, 0) + '</td>' +
                '<td class="col-num">—</td>' +
                '<td class="col-num">' + fmtNum(gtNonNet, 0) + '</td>' +
                '<td class="col-num">—</td>' +
                '<td class="col-num">' + fmtNum(gtNet + gtNonNet, 0) + '</td></tr>';

    return '<div class="ingest-table-wrap"><table class="data-table edit-table"><thead><tr>' +
           '<th class="col-text">Outage Type</th><th class="col-num">Network</th><th class="col-num">Network %</th>' +
           '<th class="col-num">Non-Network</th><th class="col-num">Non-Network %</th><th class="col-num">Grand Total</th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Grand Total per row computed as Network + Non-Network.</div>';
  }

  // F3: Category × Customers per 1k
  function renderF3(table) {
    const rows = rowsForTable('F3', state.year);
    let bodyHtml = '';
    rows.forEach(r => {
      const v = r.values || {};
      const rate = parseNumberInput(v.rate);
      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="category" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.category || '') + '</td>' +
        '<td class="col-num cell-edit" data-field="rate" data-rowid="' + r.id + '" contenteditable="true">' + (rate != null ? fmtNum(rate, 1) : '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });
    bodyHtml += '<tr class="is-add-row">' +
                '<td class="col-text"><input type="text" class="add-f3-category" placeholder="+ Add category..."></td>' +
                '<td class="col-num"><input type="text" class="add-f3-rate" placeholder="Rate" inputmode="numeric"></td>' +
                '<td class="col-actions"><button class="btn-mini" data-action="add-f3">Add</button></td></tr>';
    return '<div class="ingest-table-wrap"><table class="data-table edit-table"><thead><tr>' +
           '<th class="col-text">Category</th><th class="col-num">Customers Interrupted per 1,000 Customers Served</th><th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Reliability benchmark.</div>';
  }

  // F4 / F5: Area + Borough × {Non-Excl, Excl, Total}
  function renderFAreas(table) {
    const rows = rowsForTable(table.id, state.year);
    let bodyHtml = '';
    let gtNE = 0, gtE = 0;
    rows.forEach(r => {
      const v = r.values || {};
      const ne = parseNumberInput(v.non_excludable);
      const e = parseNumberInput(v.excludable);
      const total = (Number(ne || 0) + Number(e || 0));
      gtNE += (ne || 0); gtE += (e || 0);
      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="area" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.area || '') + '</td>' +
        '<td class="col-text cell-edit" data-field="borough" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.borough || '') + '</td>' +
        '<td class="col-num cell-edit" data-field="non_excludable" data-rowid="' + r.id + '" contenteditable="true">' + (ne != null ? fmtNum(ne, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="excludable" data-rowid="' + r.id + '" contenteditable="true">' + (e != null ? fmtNum(e, 0) : '') + '</td>' +
        '<td class="col-num cell-readonly">' + fmtNum(total, 0) + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });
    bodyHtml += '<tr class="is-add-row">' +
                '<td class="col-text"><input type="text" class="add-fareas-area" placeholder="+ Add area..."></td>' +
                '<td class="col-text"><input type="text" class="add-fareas-borough" placeholder="Borough/County"></td>' +
                '<td class="col-num"><input type="text" class="add-fareas-ne" placeholder="Non-Excl" inputmode="numeric"></td>' +
                '<td class="col-num"><input type="text" class="add-fareas-e" placeholder="Excl" inputmode="numeric"></td>' +
                '<td class="col-num cell-readonly">—</td>' +
                '<td class="col-actions"><button class="btn-mini" data-action="add-fareas" data-table="' + table.id + '">Add</button></td></tr>';
    bodyHtml += '<tr class="is-total"><td class="col-text" colspan="2">Grand Total</td>' +
                '<td class="col-num">' + fmtNum(gtNE, 0) + '</td>' +
                '<td class="col-num">' + fmtNum(gtE, 0) + '</td>' +
                '<td class="col-num">' + fmtNum(gtNE + gtE, 0) + '</td>' +
                '<td class="col-actions"></td></tr>';
    const headerLabel = table.id === 'F4' ? 'Load Area' : 'Network';
    return '<div class="ingest-table-wrap"><table class="data-table edit-table"><thead><tr>' +
           '<th class="col-text">' + headerLabel + '</th>' +
           '<th class="col-text">Borough / County</th>' +
           '<th class="col-num">Non-Excludable</th>' +
           '<th class="col-num">Excludable</th>' +
           '<th class="col-num">Grand Total</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Total per row computed as Non-Excludable + Excludable.</div>';
  }

  // F6: Mixed areas — multi-level header (NN/N x Non-Excl/Excl)
  function renderF6(table) {
    const rows = rowsForTable('F6', state.year);
    let bodyHtml = '';
    let gtNNNE = 0, gtNNE = 0, gtNNE2 = 0, gtNE = 0;
    rows.forEach(r => {
      const v = r.values || {};
      const nnNE = parseNumberInput(v.nn_non_excludable);
      const nnE = parseNumberInput(v.nn_excludable);
      const nNE = parseNumberInput(v.n_non_excludable);
      const nE = parseNumberInput(v.n_excludable);
      const total = (Number(nnNE || 0) + Number(nnE || 0) + Number(nNE || 0) + Number(nE || 0));
      gtNNNE += (nnNE || 0); gtNNE += (nnE || 0); gtNNE2 += (nNE || 0); gtNE += (nE || 0);
      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="area" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.area || '') + '</td>' +
        '<td class="col-text cell-edit" data-field="borough" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.borough || '') + '</td>' +
        '<td class="col-num cell-edit" data-field="nn_non_excludable" data-rowid="' + r.id + '" contenteditable="true">' + (nnNE != null ? fmtNum(nnNE, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="nn_excludable" data-rowid="' + r.id + '" contenteditable="true">' + (nnE != null ? fmtNum(nnE, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="n_non_excludable" data-rowid="' + r.id + '" contenteditable="true">' + (nNE != null ? fmtNum(nNE, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="n_excludable" data-rowid="' + r.id + '" contenteditable="true">' + (nE != null ? fmtNum(nE, 0) : '') + '</td>' +
        '<td class="col-num cell-readonly">' + fmtNum(total, 0) + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });
    bodyHtml += '<tr class="is-add-row">' +
                '<td class="col-text"><input type="text" class="add-f6-area" placeholder="+ Add area..."></td>' +
                '<td class="col-text"><input type="text" class="add-f6-borough" placeholder="Borough"></td>' +
                '<td class="col-num"><input type="text" class="add-f6-nnne" placeholder="NN-NonExcl" inputmode="numeric"></td>' +
                '<td class="col-num"><input type="text" class="add-f6-nne" placeholder="NN-Excl" inputmode="numeric"></td>' +
                '<td class="col-num"><input type="text" class="add-f6-nne2" placeholder="N-NonExcl" inputmode="numeric"></td>' +
                '<td class="col-num"><input type="text" class="add-f6-ne" placeholder="N-Excl" inputmode="numeric"></td>' +
                '<td class="col-num cell-readonly">—</td>' +
                '<td class="col-actions"><button class="btn-mini" data-action="add-f6">Add</button></td></tr>';
    bodyHtml += '<tr class="is-total"><td class="col-text" colspan="2">Grand Total</td>' +
                '<td class="col-num">' + fmtNum(gtNNNE, 0) + '</td>' +
                '<td class="col-num">' + fmtNum(gtNNE, 0) + '</td>' +
                '<td class="col-num">' + fmtNum(gtNNE2, 0) + '</td>' +
                '<td class="col-num">' + fmtNum(gtNE, 0) + '</td>' +
                '<td class="col-num">' + fmtNum(gtNNNE + gtNNE + gtNNE2 + gtNE, 0) + '</td>' +
                '<td class="col-actions"></td></tr>';
    return '<div class="ingest-table-wrap"><table class="data-table edit-table"><thead>' +
           '<tr><th class="col-text" rowspan="2">Network or Load Area</th>' +
           '<th class="col-text" rowspan="2">Borough / County</th>' +
           '<th class="col-num" colspan="2">NON-NETWORK</th>' +
           '<th class="col-num" colspan="2">NETWORK</th>' +
           '<th class="col-num" rowspan="2">Grand Total</th>' +
           '<th class="col-actions" rowspan="2"></th></tr>' +
           '<tr><th class="col-num">Non-Excl</th><th class="col-num">Excl</th>' +
           '<th class="col-num">Non-Excl</th><th class="col-num">Excl</th></tr></thead>' +
           '<tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Areas served by both Network and Non-Network systems. Total per row is the sum of all 4 outage-type cells.</div>';
  }

  // F7: Outage Type × {DAC, Non-DAC, Total}
  function renderF7(table) {
    const types = ['Non-Excludable', 'Excludable'];
    const rows = rowsForTable('F7', state.year);
    const byType = {};
    rows.forEach(r => { byType[r.values.outage_type] = r; });

    let bodyHtml = '';
    let gtDac = 0, gtNonDac = 0;
    types.forEach(t => {
      const r = byType[t];
      const v = r ? r.values : {};
      const dac = parseNumberInput(v.dac_customers);
      const nd = parseNumberInput(v.nondac_customers);
      const total = (Number(dac || 0) + Number(nd || 0));
      gtDac += (dac || 0); gtNonDac += (nd || 0);
      const rowid = r ? r.id : '';
      bodyHtml +=
        '<tr>' +
        '<td class="col-text">' + t + '</td>' +
        '<td class="col-num cell-edit" data-field="dac_customers" data-rowid="' + rowid + '" data-type="' + t + '" contenteditable="true">' + (dac != null ? fmtNum(dac, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="nondac_customers" data-rowid="' + rowid + '" data-type="' + t + '" contenteditable="true">' + (nd != null ? fmtNum(nd, 0) : '') + '</td>' +
        '<td class="col-num cell-readonly">' + fmtNum(total, 0) + '</td>' +
        '</tr>';
    });
    const gtTotal = gtDac + gtNonDac;
    const dacPct = gtTotal > 0 ? (gtDac / gtTotal) : null;
    const nondacPct = gtTotal > 0 ? (gtNonDac / gtTotal) : null;
    bodyHtml += '<tr class="is-total"><td class="col-text">Grand Total</td>' +
                '<td class="col-num">' + fmtNum(gtDac, 0) + '</td>' +
                '<td class="col-num">' + fmtNum(gtNonDac, 0) + '</td>' +
                '<td class="col-num">' + fmtNum(gtTotal, 0) + '</td></tr>';
    bodyHtml += '<tr class="is-subtotal"><td class="col-text">% of Grand Total</td>' +
                '<td class="col-num">' + fmtPct(dacPct) + '</td>' +
                '<td class="col-num">' + fmtPct(nondacPct) + '</td>' +
                '<td class="col-num">100%</td></tr>';
    return '<div class="ingest-table-wrap"><table class="data-table edit-table"><thead><tr>' +
           '<th class="col-text">Outage Type</th>' +
           '<th class="col-num">DAC Customers Interrupted</th>' +
           '<th class="col-num">Non-DAC Customers Interrupted</th>' +
           '<th class="col-num">Total Customers Interrupted</th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Total = DAC + Non-DAC. Bottom row shows DAC % share.</div>';
  }

  // F8 / F9: Borough × {DAC, DAC%, Non-DAC, Non-DAC%}
  function renderFBoroughs(table) {
    const rows = rowsForTable(table.id, state.year);
    let bodyHtml = '';
    let gtDac = 0, gtNonDac = 0;
    rows.forEach(r => {
      const v = r.values || {};
      const dac = parseNumberInput(v.dac);
      const dacP = parseNumberInput(v.dac_pct);
      const nd = parseNumberInput(v.non_dac);
      const ndP = parseNumberInput(v.non_dac_pct);
      gtDac += (dac || 0); gtNonDac += (nd || 0);
      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="borough" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.borough || '') + '</td>' +
        '<td class="col-num cell-edit" data-field="dac" data-rowid="' + r.id + '" contenteditable="true">' + (dac != null ? fmtNum(dac, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="dac_pct" data-rowid="' + r.id + '" data-pct="1" contenteditable="true">' + (dacP != null ? (dacP * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="non_dac" data-rowid="' + r.id + '" contenteditable="true">' + (nd != null ? fmtNum(nd, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="non_dac_pct" data-rowid="' + r.id + '" data-pct="1" contenteditable="true">' + (ndP != null ? (ndP * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });
    bodyHtml += '<tr class="is-add-row">' +
                '<td class="col-text"><input type="text" class="add-fbor-borough" placeholder="+ Add borough..."></td>' +
                '<td class="col-num"><input type="text" class="add-fbor-dac" placeholder="DAC" inputmode="numeric"></td>' +
                '<td class="col-num"><input type="text" class="add-fbor-dacp" placeholder="DAC %" inputmode="numeric"></td>' +
                '<td class="col-num"><input type="text" class="add-fbor-nd" placeholder="Non-DAC" inputmode="numeric"></td>' +
                '<td class="col-num"><input type="text" class="add-fbor-ndp" placeholder="Non-DAC %" inputmode="numeric"></td>' +
                '<td class="col-actions"><button class="btn-mini" data-action="add-fbor" data-table="' + table.id + '">Add</button></td></tr>';
    bodyHtml += '<tr class="is-total"><td class="col-text">Grand Total</td>' +
                '<td class="col-num">' + fmtNum(gtDac, 0) + '</td>' +
                '<td class="col-num">—</td>' +
                '<td class="col-num">' + fmtNum(gtNonDac, 0) + '</td>' +
                '<td class="col-num">—</td>' +
                '<td class="col-actions"></td></tr>';
    return '<div class="ingest-table-wrap"><table class="data-table edit-table"><thead><tr>' +
           '<th class="col-text">Borough / County</th>' +
           '<th class="col-num">DAC</th>' +
           '<th class="col-num">DAC % of System Total</th>' +
           '<th class="col-num">Non-DAC</th>' +
           '<th class="col-num">Non-DAC % of System Total</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Percentages can be entered as decimal (0.10) or whole (10).</div>';
  }

  // ============================================================
  // RENDERERS — Section G (Main Replacement Program)
  // ============================================================

  // G1: System-wide percentage (Category × Percentage, just 2 rows: DAC vs Non-DAC)
  function renderG1(table) {
    const rows = rowsForTable('G1', state.year);
    let bodyHtml = '';
    rows.forEach(r => {
      const v = r.values || {};
      const pct = parseNumberInput(v.percentage);
      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="category" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.category || '') + '</td>' +
        '<td class="col-num cell-edit" data-field="percentage" data-rowid="' + r.id + '" data-pct="1" contenteditable="true">' + (pct != null ? (pct * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });
    return '<div class="ingest-table-wrap"><table class="data-table edit-table"><thead><tr>' +
           '<th class="col-text">Category</th><th class="col-num">Percentage</th><th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">System-wide split of leak-prone pipe retired between DACs and Non-DACs.</div>';
  }

  // G2-G9: County tables — Segment (DAC/Non-DAC) × {Feet, Percentage}
  function renderGCounty(table) {
    const action = table.action || 'Replaced';
    const segments = ['DAC', 'Non-DAC'];
    const rows = rowsForTable(table.id, state.year);
    const bySeg = {};
    rows.forEach(r => { bySeg[r.values.segment] = r; });

    let bodyHtml = '';
    let gtFeet = 0;
    segments.forEach(seg => {
      const r = bySeg[seg];
      const v = r ? r.values : {};
      const feet = parseNumberInput(v.feet);
      const pct = parseNumberInput(v.percentage);
      gtFeet += (feet || 0);
      const rowid = r ? r.id : '';
      const label = seg === 'DAC' ? 'Feet ' + action + ' within DAC' : 'Feet ' + action + ' not in a DAC';
      bodyHtml +=
        '<tr>' +
        '<td class="col-text">' + label + '</td>' +
        '<td class="col-num cell-edit" data-field="feet" data-rowid="' + rowid + '" data-segment="' + seg + '" data-table="' + table.id + '" contenteditable="true">' + (feet != null ? fmtNum(feet, 0) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="percentage" data-rowid="' + rowid + '" data-segment="' + seg + '" data-table="' + table.id + '" data-pct="1" contenteditable="true">' + (pct != null ? (pct * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-actions"></td>' +
        '</tr>';
    });
    bodyHtml += '<tr class="is-total"><td class="col-text">County Total</td>' +
                '<td class="col-num">' + fmtNum(gtFeet, 0) + '</td>' +
                '<td class="col-num">100%</td>' +
                '<td class="col-actions"></td></tr>';
    return '<div class="ingest-table-wrap"><table class="data-table edit-table"><thead><tr>' +
           '<th class="col-text">Category</th>' +
           '<th class="col-num">Feet ' + action + '</th>' +
           '<th class="col-num">Percentage</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">County Total = DAC + Non-DAC feet.</div>';
  }

  // G10: Emissions Reductions (Category × {mT CH4, Percentage})
  function renderG10(table) {
    const rows = rowsForTable('G10', state.year);
    let bodyHtml = '';
    let gtCh4 = 0;
    rows.forEach(r => {
      const v = r.values || {};
      const ch4 = parseNumberInput(v.mt_ch4);
      const pct = parseNumberInput(v.percentage);
      gtCh4 += (ch4 || 0);
      bodyHtml +=
        '<tr>' +
        '<td class="col-text cell-edit" data-field="category" data-rowid="' + r.id + '" contenteditable="true">' + escapeHtml(v.category || '') + '</td>' +
        '<td class="col-num cell-edit" data-field="mt_ch4" data-rowid="' + r.id + '" contenteditable="true">' + (ch4 != null ? fmtNum(ch4, 2) : '') + '</td>' +
        '<td class="col-num cell-edit" data-field="percentage" data-rowid="' + r.id + '" data-pct="1" contenteditable="true">' + (pct != null ? (pct * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="col-actions"><button class="row-delete-btn" data-action="delete-row" data-rowid="' + r.id + '" title="Delete">×</button></td>' +
        '</tr>';
    });
    bodyHtml += '<tr class="is-total"><td class="col-text">Grand Total</td>' +
                '<td class="col-num">' + fmtNum(gtCh4, 2) + '</td>' +
                '<td class="col-num">100%</td>' +
                '<td class="col-actions"></td></tr>';
    return '<div class="ingest-table-wrap"><table class="data-table edit-table"><thead><tr>' +
           '<th class="col-text">Category</th>' +
           '<th class="col-num">mT CH4</th>' +
           '<th class="col-num">Percentage</th>' +
           '<th class="col-actions"></th>' +
           '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
           '<div class="edit-table-help">Methane emission reductions in metric tons.</div>';
  }

  // ============================================================
  // EDIT HANDLERS — A1/A2
  // ============================================================
  function handleA1A2Edit(cell, table) {
    const idx = parseInt(cell.dataset.idx, 10);
    const field = cell.dataset.field;
    const newVal = parseNumberInput(cell.textContent);
    if (newVal == null) { renderEditor(); return; }

    const measureField = table.measure;
    const rows = rowsForTable(table.id, state.year);
    const byProgram = {};
    rows.forEach(r => {
      const p = r.values.program || '';
      if (!byProgram[p]) byProgram[p] = { program: p, dacRow: null, nonDacRow: null };
      if (/^DAC$/i.test(r.values.segment)) byProgram[p].dacRow = r;
      else if (/^Non-DAC$/i.test(r.values.segment)) byProgram[p].nonDacRow = r;
    });
    const displayRows = Object.values(byProgram).map(g => {
      const dac = parseNumberInput(g.dacRow ? g.dacRow.values[measureField] : null) || 0;
      const nondac = parseNumberInput(g.nonDacRow ? g.nonDacRow.values[measureField] : null) || 0;
      return { program: g.program, total: dac + nondac, dac, nondac, dacRow: g.dacRow, nonDacRow: g.nonDacRow };
    }).sort((a, b) => b.total - a.total);

    const target = displayRows[idx];
    if (!target) return;

    let newDac, newNondac;
    if (field === 'dac') {
      newDac = newVal; newNondac = target.total - newVal;
      if (newNondac < 0) { alert('DAC cannot exceed Total. Reverting.'); renderEditor(); return; }
    } else {
      newDac = target.dac; newNondac = newVal - target.dac;
      if (newNondac < 0) { alert('Total cannot be less than DAC. Reverting.'); renderEditor(); return; }
    }

    const all = loadAllRows();
    function upsert(seg, val) {
      const seekRow = seg === 'DAC' ? target.dacRow : target.nonDacRow;
      if (seekRow) {
        const r = all.find(x => x.id === seekRow.id);
        if (r) { r.values = Object.assign({}, r.values); r.values[measureField] = val; r.updated_at = new Date().toISOString(); }
      } else {
        all.push({ id: newId(), section: 'A',
          values: { year: state.year, segment: seg, program: target.program, measure: '',
                    incentive_dollars: measureField === 'incentive_dollars' ? val : '',
                    energy_savings_mmbtu: measureField === 'energy_savings_mmbtu' ? val : '',
                    participants: '', installations: '' },
          status: 'edited', created_at: new Date().toISOString() });
      }
    }
    upsert('DAC', newDac);
    upsert('Non-DAC', newNondac);
    saveAllRows(all);
    renderEditor();
  }

  function handleA3Edit(cell) {
    const rowid = cell.dataset.rowid;
    const field = cell.dataset.field;
    const newVal = parseNumberInput(cell.textContent);
    const all = loadAllRows();
    const r = all.find(x => x.id === rowid);
    if (!r) { renderEditor(); return; }
    r.values = Object.assign({}, r.values);
    r.values[field] = newVal == null ? '' : newVal;
    r.updated_at = new Date().toISOString();
    saveAllRows(all);
    renderEditor();
  }

  function handleA5A8Edit(cell) {
    const dacId = cell.dataset.rowid;
    const nondacId = cell.dataset.rowidNondac;
    const program = cell.dataset.program;
    const measure = cell.dataset.measure;
    const field = cell.dataset.field;
    const newVal = parseNumberInput(cell.textContent);
    if (newVal == null) { renderEditor(); return; }
    const all = loadAllRows();
    let dacRow = dacId ? all.find(x => x.id === dacId) : null;
    let nondacRow = nondacId ? all.find(x => x.id === nondacId) : null;
    const currDac = dacRow ? (parseNumberInput(dacRow.values.installations) || 0) : 0;
    const currNondac = nondacRow ? (parseNumberInput(nondacRow.values.installations) || 0) : 0;
    const currTotal = currDac + currNondac;
    let newDac, newNondac;
    if (field === 'install_dac') {
      newDac = newVal; newNondac = currTotal - newVal;
      if (newNondac < 0) { alert('DAC cannot exceed Total.'); renderEditor(); return; }
    } else {
      newDac = currDac; newNondac = newVal - currDac;
      if (newNondac < 0) { alert('Total cannot be less than DAC.'); renderEditor(); return; }
    }
    const tabs = TABLES_BY_SECTION.A;
    const table = tabs.find(t => t.id === state.table);
    const segBase = table.segmentBase;
    function ensureRow(existing, segLabel, value) {
      if (existing) {
        existing.values = Object.assign({}, existing.values, { installations: value });
        existing.updated_at = new Date().toISOString();
      } else {
        all.push({ id: newId(), section: 'A',
          values: { year: state.year, segment: segBase + ' / ' + segLabel, program: program, measure: measure,
                    incentive_dollars: '', energy_savings_mmbtu: '', participants: '', installations: value },
          status: 'edited', created_at: new Date().toISOString() });
      }
    }
    ensureRow(dacRow, 'DAC', newDac);
    ensureRow(nondacRow, 'Non-DAC', newNondac);
    saveAllRows(all);
    renderEditor();
  }

  // ============================================================
  // EDIT HANDLERS — B & C
  // ============================================================
  function handleBSimpleEdit(cell) {
    // B1: edit funding_dollars
    const rowid = cell.dataset.rowid;
    const segment = cell.dataset.segment;
    const newVal = parseNumberInput(cell.textContent);
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values, { funding_dollars: newVal == null ? '' : newVal });
      r.updated_at = new Date().toISOString();
    } else {
      all.push({ id: newId(), section: 'B',
        values: { _table: 'B1', year: state.year, segment: segment, funding_dollars: newVal == null ? '' : newVal },
        status: 'edited', created_at: new Date().toISOString() });
    }
    saveAllRows(all);
    renderEditor();
  }

  function handleBMatrixEdit(cell) {
    // B2: edit plugs for a specific (segment, charger_type)
    const rowid = cell.dataset.rowid;
    const segment = cell.dataset.segment;
    const charger = cell.dataset.charger;
    const newVal = parseNumberInput(cell.textContent);
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values, { plugs: newVal == null ? '' : newVal });
      r.updated_at = new Date().toISOString();
    } else {
      all.push({ id: newId(), section: 'B',
        values: { _table: 'B2', year: state.year, segment: segment, charger_type: charger, plugs: newVal == null ? '' : newVal },
        status: 'edited', created_at: new Date().toISOString() });
    }
    saveAllRows(all);
    renderEditor();
  }

  function handleC1Edit(cell) {
    const rowid = cell.dataset.rowid;
    const field = cell.dataset.field;
    const newVal = cell.textContent.trim();
    const all = loadAllRows();
    const r = all.find(x => x.id === rowid);
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal;
      r.updated_at = new Date().toISOString();
      saveAllRows(all);
    }
  }

  function handleC2Edit(cell) {
    // C2: edit participants/committed_mw/avg_event_mw for a segment
    const rowid = cell.dataset.rowid;
    const segment = cell.dataset.segment;
    const field = cell.dataset.field;
    const newVal = parseNumberInput(cell.textContent);
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal == null ? '' : newVal;
      r.updated_at = new Date().toISOString();
    } else {
      all.push({ id: newId(), section: 'C',
        values: { _table: 'C2', year: state.year, segment: segment,
                  participants: field === 'participants' ? newVal : '',
                  committed_mw: field === 'committed_mw' ? newVal : '',
                  avg_event_mw: field === 'avg_event_mw' ? newVal : '' },
        status: 'edited', created_at: new Date().toISOString() });
    }
    saveAllRows(all);
    renderEditor();
  }

  function handleCProgramEdit(cell) {
    // C3, C4, C5: edit participants/committed_mw/delivered_mw of a row
    const rowid = cell.dataset.rowid;
    const field = cell.dataset.field;
    const newVal = parseNumberInput(cell.textContent);
    const all = loadAllRows();
    const r = all.find(x => x.id === rowid);
    if (!r) { renderEditor(); return; }
    r.values = Object.assign({}, r.values);
    r.values[field] = newVal == null ? '' : newVal;
    r.updated_at = new Date().toISOString();
    saveAllRows(all);
    renderEditor();
  }

  // ============================================================
  // EDIT HANDLERS — D & E
  // ============================================================
  function handleD1Edit(cell) {
    const rowid = cell.dataset.rowid;
    const field = cell.dataset.field;
    const newVal = cell.textContent.trim();
    const all = loadAllRows();
    const r = all.find(x => x.id === rowid);
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal;
      r.updated_at = new Date().toISOString();
      saveAllRows(all);
    }
  }

  function handleDCumulativeEdit(cell) {
    const rowid = cell.dataset.rowid;
    const field = cell.dataset.field;  // 'cumulative' or 'current_year'
    const metric = cell.dataset.metric;
    const tableId = cell.dataset.table;
    const isPct = cell.dataset.pct === '1';
    let newVal = parseNumberInput(cell.textContent);
    if (newVal == null) { renderEditor(); return; }
    // If percent: accept either decimal (0.32) or whole (32). If > 1, divide by 100.
    if (isPct && newVal > 1) newVal = newVal / 100;
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal;
      r.updated_at = new Date().toISOString();
    } else {
      // Create new row
      all.push({
        id: newId(), section: 'D',
        values: { _table: tableId, year: state.year, metric: metric,
                  cumulative: field === 'cumulative' ? newVal : '',
                  current_year: field === 'current_year' ? newVal : '' },
        status: 'edited', created_at: new Date().toISOString()
      });
    }
    saveAllRows(all);
    renderEditor();
  }

  function handleE1Edit(cell) {
    const rowid = cell.dataset.rowid;
    const field = cell.dataset.field;
    const all = loadAllRows();
    const r = all.find(x => x.id === rowid);
    if (!r) { renderEditor(); return; }
    r.values = Object.assign({}, r.values);
    if (field === 'category') {
      r.values[field] = cell.textContent.trim();
    } else if (field === 'pct_affecting_dacs') {
      let v = parseNumberInput(cell.textContent);
      if (v != null && v > 1) v = v / 100;  // accept whole percent
      r.values[field] = v == null ? '' : v;
    } else {
      const v = parseNumberInput(cell.textContent);
      r.values[field] = v == null ? '' : v;
    }
    r.updated_at = new Date().toISOString();
    saveAllRows(all);
    renderEditor();
  }

  // ============================================================
  // EDIT HANDLERS — H & I
  // ============================================================
  function handleH1Edit(cell) {
    const rowid = cell.dataset.rowid;
    const field = cell.dataset.field;
    const borough = cell.dataset.borough;
    const newVal = parseNumberInput(cell.textContent);
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal == null ? '' : newVal;
      r.updated_at = new Date().toISOString();
    } else {
      // Create new row for this borough
      all.push({
        id: newId(), section: 'H',
        values: { _table: 'H1', year: state.year, borough: borough,
                  non_dac_repairs: field === 'non_dac_repairs' ? newVal : '',
                  dac_repairs: field === 'dac_repairs' ? newVal : '' },
        status: 'edited', created_at: new Date().toISOString()
      });
    }
    saveAllRows(all);
    renderEditor();
  }

  function handleI1Edit(cell) {
    const rowid = cell.dataset.rowid;
    const field = cell.dataset.field;
    const newVal = cell.textContent.trim();
    const all = loadAllRows();
    const r = all.find(x => x.id === rowid);
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal;
      r.updated_at = new Date().toISOString();
      saveAllRows(all);
    }
  }

  // ============================================================
  // EDIT HANDLERS — Section J
  // ============================================================
  // jMetric edit (J1, J2, J5, J9)
  function handleJMetricEdit(cell) {
    const rowid = cell.dataset.rowid;
    const field = cell.dataset.field;
    const isPct = cell.dataset.pct === '1';
    const all = loadAllRows();
    const r = all.find(x => x.id === rowid);
    if (!r) { renderEditor(); return; }
    r.values = Object.assign({}, r.values);
    if (field === 'metric') {
      r.values.metric = cell.textContent.trim();
    } else {
      let newVal = parseNumberInput(cell.textContent);
      if (isPct && newVal != null && newVal > 1) newVal = newVal / 100;
      r.values[field] = newVal == null ? '' : newVal;
    }
    r.updated_at = new Date().toISOString();
    saveAllRows(all);
    renderEditor();
  }

  // jSegment4 edit (J3, J4, J6)
  function handleJSegment4Edit(cell) {
    const rowid = cell.dataset.rowid;
    const segment = cell.dataset.segment;
    const tableId = cell.dataset.table;
    const field = cell.dataset.field;
    const isPct = cell.dataset.pct === '1';
    let newVal = parseNumberInput(cell.textContent);
    if (isPct && newVal != null && newVal > 1) newVal = newVal / 100;
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal == null ? '' : newVal;
      r.updated_at = new Date().toISOString();
    } else {
      // Create new row for this segment in this table
      const seed = { _table: tableId, year: state.year, segment: segment,
                     accounts: '', accounts_pct: '', amount: '', amount_pct: '' };
      seed[field] = newVal == null ? '' : newVal;
      all.push({ id: newId(), section: 'J', values: seed,
                 status: 'edited', created_at: new Date().toISOString() });
    }
    saveAllRows(all);
    renderEditor();
  }

  // J7 edit
  function handleJ7Edit(cell) {
    const rowid = cell.dataset.rowid;
    const segment = cell.dataset.segment;
    const field = cell.dataset.field;
    const isPct = cell.dataset.pct === '1';
    let newVal = parseNumberInput(cell.textContent);
    if (isPct && newVal != null && newVal > 1) newVal = newVal / 100;
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal == null ? '' : newVal;
      r.updated_at = new Date().toISOString();
    } else {
      const seed = { _table: 'J7', year: state.year, segment: segment,
                     electric_only: '', gas_only: '', dual_service: '', accounts_pct: '' };
      seed[field] = newVal == null ? '' : newVal;
      all.push({ id: newId(), section: 'J', values: seed,
                 status: 'edited', created_at: new Date().toISOString() });
    }
    saveAllRows(all);
    renderEditor();
  }

  // J8 edit
  function handleJ8Edit(cell) {
    const rowid = cell.dataset.rowid;
    const segment = cell.dataset.segment;
    const field = cell.dataset.field;
    const isPct = cell.dataset.pct === '1';
    let newVal = parseNumberInput(cell.textContent);
    if (isPct && newVal != null && newVal > 1) newVal = newVal / 100;
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal == null ? '' : newVal;
      r.updated_at = new Date().toISOString();
    } else {
      const seed = { _table: 'J8', year: state.year, segment: segment,
                     electric: '', gas: '', amount_pct: '' };
      seed[field] = newVal == null ? '' : newVal;
      all.push({ id: newId(), section: 'J', values: seed,
                 status: 'edited', created_at: new Date().toISOString() });
    }
    saveAllRows(all);
    renderEditor();
  }

  // ============================================================
  // EDIT HANDLERS — Sections F & G
  // ============================================================
  // Generic helper for "edit a row by id with field=newVal" (with optional pct conversion)
  function genericRowEdit(cell, sectionLetter) {
    const rowid = cell.dataset.rowid;
    const field = cell.dataset.field;
    const isPct = cell.dataset.pct === '1';
    const all = loadAllRows();
    const r = all.find(x => x.id === rowid);
    if (!r) { renderEditor(); return; }
    r.values = Object.assign({}, r.values);
    if (cell.classList.contains('col-text') || cell.dataset.field === 'area' || cell.dataset.field === 'borough' || cell.dataset.field === 'category' || cell.dataset.field === 'term' || cell.dataset.field === 'description') {
      r.values[field] = cell.textContent.trim();
    } else {
      let newVal = parseNumberInput(cell.textContent);
      if (isPct && newVal != null && newVal > 1) newVal = newVal / 100;
      r.values[field] = newVal == null ? '' : newVal;
    }
    r.updated_at = new Date().toISOString();
    saveAllRows(all);
    renderEditor();
  }

  function handleF1Edit(cell) { genericRowEdit(cell, 'F'); }
  function handleF3Edit(cell) { genericRowEdit(cell, 'F'); }
  function handleFAreasEdit(cell) { genericRowEdit(cell, 'F'); }
  function handleF6Edit(cell) { genericRowEdit(cell, 'F'); }
  function handleFBoroughsEdit(cell) { genericRowEdit(cell, 'F'); }
  function handleG1Edit(cell) { genericRowEdit(cell, 'G'); }
  function handleG10Edit(cell) { genericRowEdit(cell, 'G'); }

  // F2: Outage Type × {Network, Non-Network} (no row to delete since fixed types)
  function handleF2Edit(cell) {
    const rowid = cell.dataset.rowid;
    const outageType = cell.dataset.type;
    const field = cell.dataset.field;
    const isPct = cell.dataset.pct === '1';
    let newVal = parseNumberInput(cell.textContent);
    if (isPct && newVal != null && newVal > 1) newVal = newVal / 100;
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal == null ? '' : newVal;
      r.updated_at = new Date().toISOString();
    } else {
      const seed = { _table: 'F2', year: state.year, outage_type: outageType,
                     network: '', network_pct: '', non_network: '', non_network_pct: '' };
      seed[field] = newVal == null ? '' : newVal;
      all.push({ id: newId(), section: 'F', values: seed,
                 status: 'edited', created_at: new Date().toISOString() });
    }
    saveAllRows(all);
    renderEditor();
  }

  // F7: Outage Type × {DAC, Non-DAC}
  function handleF7Edit(cell) {
    const rowid = cell.dataset.rowid;
    const outageType = cell.dataset.type;
    const field = cell.dataset.field;
    let newVal = parseNumberInput(cell.textContent);
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal == null ? '' : newVal;
      r.updated_at = new Date().toISOString();
    } else {
      const seed = { _table: 'F7', year: state.year, outage_type: outageType,
                     dac_customers: '', nondac_customers: '' };
      seed[field] = newVal == null ? '' : newVal;
      all.push({ id: newId(), section: 'F', values: seed,
                 status: 'edited', created_at: new Date().toISOString() });
    }
    saveAllRows(all);
    renderEditor();
  }

  // gCounty: Segment (DAC/Non-DAC) × {Feet, Percentage}
  function handleGCountyEdit(cell) {
    const rowid = cell.dataset.rowid;
    const segment = cell.dataset.segment;
    const tableId = cell.dataset.table;
    const field = cell.dataset.field;
    const isPct = cell.dataset.pct === '1';
    let newVal = parseNumberInput(cell.textContent);
    if (isPct && newVal != null && newVal > 1) newVal = newVal / 100;
    const all = loadAllRows();
    let r = rowid ? all.find(x => x.id === rowid) : null;
    if (r) {
      r.values = Object.assign({}, r.values);
      r.values[field] = newVal == null ? '' : newVal;
      r.updated_at = new Date().toISOString();
    } else {
      const seed = { _table: tableId, year: state.year, segment: segment,
                     feet: '', percentage: '' };
      seed[field] = newVal == null ? '' : newVal;
      all.push({ id: newId(), section: 'G', values: seed,
                 status: 'edited', created_at: new Date().toISOString() });
    }
    saveAllRows(all);
    renderEditor();
  }

  // ============================================================
  // ADD ROW HANDLERS
  // ============================================================
  function handleAddProgramA1A2() {
    const name = document.getElementById('add-program-name').value.trim();
    const total = parseNumberInput(document.getElementById('add-program-total').value);
    const dac = parseNumberInput(document.getElementById('add-program-dac').value);
    if (!name) { alert('Program name is required.'); return; }
    if (total == null && dac == null) { alert('Enter Total or DAC.'); return; }
    const tabs = TABLES_BY_SECTION.A;
    const table = tabs.find(t => t.id === state.table);
    const measureField = table.measure;
    const totalVal = total != null ? total : (dac || 0);
    const dacVal = dac != null ? dac : 0;
    const nondacVal = totalVal - dacVal;
    if (nondacVal < 0) { alert('DAC cannot exceed Total.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'A',
      values: { year: state.year, segment: 'DAC', program: name, measure: '',
                incentive_dollars: measureField === 'incentive_dollars' ? dacVal : '',
                energy_savings_mmbtu: measureField === 'energy_savings_mmbtu' ? dacVal : '',
                participants: '', installations: '' },
      status: 'added', created_at: new Date().toISOString() });
    all.push({ id: newId(), section: 'A',
      values: { year: state.year, segment: 'Non-DAC', program: name, measure: '',
                incentive_dollars: measureField === 'incentive_dollars' ? nondacVal : '',
                energy_savings_mmbtu: measureField === 'energy_savings_mmbtu' ? nondacVal : '',
                participants: '', installations: '' },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddProgramA3(segment, addRow) {
    const name = addRow.querySelector('.add-prog-name').value.trim();
    const participants = parseNumberInput(addRow.querySelector('.add-prog-participants').value);
    const inc = parseNumberInput(addRow.querySelector('.add-prog-inc').value);
    const mmbtu = parseNumberInput(addRow.querySelector('.add-prog-mmbtu').value);
    if (!name) { alert('Program name is required.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'A',
      values: { year: state.year, segment: segment, program: name, measure: '',
                incentive_dollars: inc != null ? inc : '',
                energy_savings_mmbtu: mmbtu != null ? mmbtu : '',
                participants: participants != null ? participants : '',
                installations: '' },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddMeasure(program, addRow) {
    const name = addRow.querySelector('.add-meas-name').value.trim();
    const total = parseNumberInput(addRow.querySelector('.add-meas-total').value);
    const dac = parseNumberInput(addRow.querySelector('.add-meas-dac').value);
    if (!name) { alert('Measure name is required.'); return; }
    if (total == null && dac == null) { alert('Enter Total or DAC.'); return; }
    const tabs = TABLES_BY_SECTION.A;
    const table = tabs.find(t => t.id === state.table);
    const segBase = table.segmentBase;
    const totalVal = total != null ? total : (dac || 0);
    const dacVal = dac != null ? dac : 0;
    const nondacVal = totalVal - dacVal;
    if (nondacVal < 0) { alert('DAC cannot exceed Total.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'A',
      values: { year: state.year, segment: segBase + ' / DAC', program: program, measure: name,
                incentive_dollars: '', energy_savings_mmbtu: '', participants: '', installations: dacVal },
      status: 'added', created_at: new Date().toISOString() });
    all.push({ id: newId(), section: 'A',
      values: { year: state.year, segment: segBase + ' / Non-DAC', program: program, measure: name,
                incentive_dollars: '', energy_savings_mmbtu: '', participants: '', installations: nondacVal },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddProgramA5A8() {
    const name = document.getElementById('add-a5-program').value.trim();
    if (!name) { alert('Program name is required.'); return; }
    const tabs = TABLES_BY_SECTION.A;
    const table = tabs.find(t => t.id === state.table);
    const segBase = table.segmentBase;
    const all = loadAllRows();
    all.push({ id: newId(), section: 'A',
      values: { year: state.year, segment: segBase + ' / DAC', program: name, measure: '(new measure)',
                incentive_dollars: '', energy_savings_mmbtu: '', participants: '', installations: 0 },
      status: 'added', created_at: new Date().toISOString() });
    all.push({ id: newId(), section: 'A',
      values: { year: state.year, segment: segBase + ' / Non-DAC', program: name, measure: '(new measure)',
                incentive_dollars: '', energy_savings_mmbtu: '', participants: '', installations: 0 },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddC1(addRow) {
    const prog = addRow.querySelector('.add-c1-program').value.trim();
    const cat = addRow.querySelector('.add-c1-category').value.trim();
    const desc = addRow.querySelector('.add-c1-description').value.trim();
    if (!prog) { alert('Program name is required.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'C',
      values: { _table: 'C1', year: state.year, program: prog, category: cat, description: desc },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddCProgram(tableId, segment, addRow) {
    const name = addRow.querySelector('.add-cprog-name').value.trim();
    const part = parseNumberInput(addRow.querySelector('.add-cprog-part').value);
    const comm = parseNumberInput(addRow.querySelector('.add-cprog-comm').value);
    const deliv = parseNumberInput(addRow.querySelector('.add-cprog-deliv').value);
    if (!name) { alert('Program name is required.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'C',
      values: { _table: tableId, year: state.year, segment: segment, program: name,
                participants: part != null ? part : '',
                committed_mw: comm != null ? comm : '',
                delivered_mw: deliv != null ? deliv : '' },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddD1(addRow) {
    const ctype = addRow.querySelector('.add-d1-type').value.trim();
    const desc = addRow.querySelector('.add-d1-description').value.trim();
    if (!ctype) { alert('Compensation type is required.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'D',
      values: { _table: 'D1', year: state.year, compensation_type: ctype, description: desc },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddE1(addRow) {
    const cat = addRow.querySelector('.add-e1-category').value.trim();
    const total = parseNumberInput(addRow.querySelector('.add-e1-total').value);
    let pct = parseNumberInput(addRow.querySelector('.add-e1-pct').value);
    if (!cat) { alert('Category is required.'); return; }
    if (pct != null && pct > 1) pct = pct / 100;
    const all = loadAllRows();
    all.push({ id: newId(), section: 'E',
      values: { _table: 'E1', year: state.year, category: cat,
                total_investment: total != null ? total : '',
                pct_affecting_dacs: pct != null ? pct : '' },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddH1(addRow) {
    const borough = addRow.querySelector('.add-h1-borough').value.trim();
    const nd = parseNumberInput(addRow.querySelector('.add-h1-nondac').value);
    const d = parseNumberInput(addRow.querySelector('.add-h1-dac').value);
    if (!borough) { alert('Borough is required.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'H',
      values: { _table: 'H1', year: state.year, borough: borough,
                non_dac_repairs: nd != null ? nd : '',
                dac_repairs: d != null ? d : '' },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddI1(addRow) {
    const metric = addRow.querySelector('.add-i1-metric').value.trim();
    const uniq = addRow.querySelector('.add-i1-unique').value.trim();
    const nonu = addRow.querySelector('.add-i1-nonunique').value.trim();
    if (!metric) { alert('Metric is required.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'I',
      values: { _table: 'I1', year: state.year, metric: metric, unique: uniq, non_unique: nonu },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddJMetric(tableId, addRow) {
    const metric = addRow.querySelector('.add-jm-metric').value.trim();
    const dacV = parseNumberInput(addRow.querySelector('.add-jm-dacv').value);
    let dacP = parseNumberInput(addRow.querySelector('.add-jm-dacp').value);
    const ndV = parseNumberInput(addRow.querySelector('.add-jm-ndv').value);
    let ndP = parseNumberInput(addRow.querySelector('.add-jm-ndp').value);
    if (!metric) { alert('Metric is required.'); return; }
    if (dacP != null && dacP > 1) dacP = dacP / 100;
    if (ndP != null && ndP > 1) ndP = ndP / 100;
    const all = loadAllRows();
    all.push({ id: newId(), section: 'J',
      values: { _table: tableId, year: state.year, metric: metric,
                dac_value: dacV != null ? dacV : '',
                dac_pct: dacP != null ? dacP : '',
                nondac_value: ndV != null ? ndV : '',
                nondac_pct: ndP != null ? ndP : '' },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddF1(addRow) {
    const term = addRow.querySelector('.add-f1-term').value.trim();
    const desc = addRow.querySelector('.add-f1-description').value.trim();
    if (!term) { alert('Term is required.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'F',
      values: { _table: 'F1', year: state.year, term: term, description: desc },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddF3(addRow) {
    const cat = addRow.querySelector('.add-f3-category').value.trim();
    const rate = parseNumberInput(addRow.querySelector('.add-f3-rate').value);
    if (!cat) { alert('Category is required.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'F',
      values: { _table: 'F3', year: state.year, category: cat, rate: rate != null ? rate : '' },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddFAreas(tableId, addRow) {
    const area = addRow.querySelector('.add-fareas-area').value.trim();
    const borough = addRow.querySelector('.add-fareas-borough').value.trim();
    const ne = parseNumberInput(addRow.querySelector('.add-fareas-ne').value);
    const e = parseNumberInput(addRow.querySelector('.add-fareas-e').value);
    if (!area) { alert('Area is required.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'F',
      values: { _table: tableId, year: state.year, area: area, borough: borough,
                non_excludable: ne != null ? ne : '', excludable: e != null ? e : '' },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddF6(addRow) {
    const area = addRow.querySelector('.add-f6-area').value.trim();
    const borough = addRow.querySelector('.add-f6-borough').value.trim();
    const nnNE = parseNumberInput(addRow.querySelector('.add-f6-nnne').value);
    const nnE = parseNumberInput(addRow.querySelector('.add-f6-nne').value);
    const nNE = parseNumberInput(addRow.querySelector('.add-f6-nne2').value);
    const nE = parseNumberInput(addRow.querySelector('.add-f6-ne').value);
    if (!area) { alert('Area is required.'); return; }
    const all = loadAllRows();
    all.push({ id: newId(), section: 'F',
      values: { _table: 'F6', year: state.year, area: area, borough: borough,
                nn_non_excludable: nnNE != null ? nnNE : '',
                nn_excludable: nnE != null ? nnE : '',
                n_non_excludable: nNE != null ? nNE : '',
                n_excludable: nE != null ? nE : '' },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  function handleAddFBoroughs(tableId, addRow) {
    const borough = addRow.querySelector('.add-fbor-borough').value.trim();
    const dac = parseNumberInput(addRow.querySelector('.add-fbor-dac').value);
    let dacP = parseNumberInput(addRow.querySelector('.add-fbor-dacp').value);
    const nd = parseNumberInput(addRow.querySelector('.add-fbor-nd').value);
    let ndP = parseNumberInput(addRow.querySelector('.add-fbor-ndp').value);
    if (!borough) { alert('Borough is required.'); return; }
    if (dacP != null && dacP > 1) dacP = dacP / 100;
    if (ndP != null && ndP > 1) ndP = ndP / 100;
    const all = loadAllRows();
    all.push({ id: newId(), section: 'F',
      values: { _table: tableId, year: state.year, borough: borough,
                dac: dac != null ? dac : '',
                dac_pct: dacP != null ? dacP : '',
                non_dac: nd != null ? nd : '',
                non_dac_pct: ndP != null ? ndP : '' },
      status: 'added', created_at: new Date().toISOString() });
    saveAllRows(all);
    renderEditor();
  }

  // ============================================================
  // DELETE HANDLERS
  // ============================================================
  function handleDeleteRowA1A2(idx) {
    const tabs = TABLES_BY_SECTION.A;
    const table = tabs.find(t => t.id === state.table);
    const rows = rowsForTable(table.id, state.year);
    const byProgram = {};
    rows.forEach(r => {
      const p = r.values.program || '';
      if (!byProgram[p]) byProgram[p] = { program: p, dacRow: null, nonDacRow: null };
      if (/^DAC$/i.test(r.values.segment)) byProgram[p].dacRow = r;
      else if (/^Non-DAC$/i.test(r.values.segment)) byProgram[p].nonDacRow = r;
    });
    const measureField = table.measure;
    const displayRows = Object.values(byProgram).map(g => {
      const dac = parseNumberInput(g.dacRow ? g.dacRow.values[measureField] : null) || 0;
      const nondac = parseNumberInput(g.nonDacRow ? g.nonDacRow.values[measureField] : null) || 0;
      return { program: g.program, total: dac + nondac, dac, dacRow: g.dacRow, nonDacRow: g.nonDacRow };
    }).sort((a, b) => b.total - a.total);
    const target = displayRows[idx];
    if (!target) return;
    if (!confirm('Delete program "' + target.program + '" for ' + state.year + '?')) return;
    let all = loadAllRows();
    if (target.dacRow) all = all.filter(r => r.id !== target.dacRow.id);
    if (target.nonDacRow) all = all.filter(r => r.id !== target.nonDacRow.id);
    saveAllRows(all);
    renderEditor();
  }

  function handleDeleteRowById(rowid) {
    if (!confirm('Delete this row?')) return;
    const all = loadAllRows().filter(r => r.id !== rowid);
    saveAllRows(all);
    renderEditor();
  }

  function handleDeleteMeasure(program, measure) {
    if (!confirm('Delete measure "' + measure + '" of program "' + program + '" for ' + state.year + '?')) return;
    const tabs = TABLES_BY_SECTION.A;
    const table = tabs.find(t => t.id === state.table);
    const segBase = table.segmentBase;
    const all = loadAllRows().filter(r => {
      if (r.section !== 'A') return true;
      if (String(r.values.year) !== String(state.year)) return true;
      if (r.values.program !== program) return true;
      if (r.values.measure !== measure) return true;
      const seg = r.values.segment || '';
      return !(seg.indexOf(segBase + ' /') === 0);
    });
    saveAllRows(all);
    renderEditor();
  }

  // ============================================================
  // ADD YEAR / DELETE YEAR
  // ============================================================
  function handleAddYearConfirm() {
    const yearStr = String(document.getElementById('add-year-input').value).trim();
    if (!/^\d{4}$/.test(yearStr)) { alert('Enter a 4-digit year.'); return; }
    const newYear = yearStr;
    const all = loadAllRows();
    const existingYears = new Set(all.filter(r => r.section === state.section).map(r => String(r.values.year)));
    if (existingYears.has(newYear)) { alert('Year ' + newYear + ' already exists.'); return; }
    const sorted = Array.from(existingYears).sort().reverse();
    const sourceYear = sorted[0];
    if (!sourceYear) {
      // No prior year for this section, add a placeholder so the year appears
      all.push({ id: newId(), section: state.section,
        values: { year: newYear }, status: 'placeholder', created_at: new Date().toISOString() });
    } else {
      const sourceRows = all.filter(r => r.section === state.section && String(r.values.year) === String(sourceYear));
      sourceRows.forEach(src => {
        const cleared = Object.assign({}, src.values);
        cleared.year = newYear;
        // Clear all numeric measure fields; keep dimension fields
        const numericKeys = ['incentive_dollars', 'energy_savings_mmbtu', 'participants', 'installations',
                             'funding_dollars', 'plugs', 'committed_mw', 'delivered_mw', 'avg_event_mw'];
        numericKeys.forEach(k => { if (k in cleared) cleared[k] = ''; });
        all.push({ id: newId(), section: state.section, values: cleared,
                   status: 'template', created_at: new Date().toISOString() });
      });
    }
    saveAllRows(all);
    document.getElementById('add-year-modal').hidden = true;
    state.year = newYear;
    renderToolbar();
    renderEditor();
  }

  function handleDeleteYear() {
    const years = getAvailableYears(state.section);
    if (years.length <= 1) { alert('Cannot delete the only year. Add another year first.'); return; }
    if (!confirm('Delete ALL data for ' + state.year + ' in Section ' + state.section + '? This cannot be undone.')) return;
    const all = loadAllRows().filter(r =>
      !(r.section === state.section && String(r.values.year) === String(state.year))
    );
    saveAllRows(all);
    state.year = years.find(y => y !== state.year) || '2024';
    renderToolbar();
    renderEditor();
  }

  // ============================================================
  // TOOLBAR & ORCHESTRATION
  // ============================================================
  function renderToolbar() {
    const yearSel = document.getElementById('ingest-year-select');
    const years = getAvailableYears(state.section);
    if (!years.includes(state.year)) state.year = years[0];
    yearSel.innerHTML = years.map(y =>
      '<option value="' + y + '"' + (y === state.year ? ' selected' : '') + '>' + y + '</option>'
    ).join('');

    const tableSel = document.getElementById('ingest-table-select');
    const tabs = TABLES_BY_SECTION[state.section] || [];
    if (!tabs.find(t => t.id === state.table)) {
      state.table = tabs.length ? tabs[0].id : null;
    }
    tableSel.innerHTML = tabs.map(t =>
      '<option value="' + t.id + '"' + (t.id === state.table ? ' selected' : '') + '>' + t.label + (t.editable ? '' : ' · derived') + '</option>'
    ).join('');
  }

  function renderEditor() {
    const tabs = TABLES_BY_SECTION[state.section] || [];
    const table = tabs.find(t => t.id === state.table);
    const area = document.getElementById('ingest-editor-area');
    if (!table) {
      area.innerHTML = '<div class="empty-pane">No editable tables yet for Section ' + state.section + '.</div>';
      return;
    }

    let editorHtml = '';
    switch (table.kind) {
      case 'a1a2': editorHtml = renderA1A2(table); break;
      case 'a3a4': editorHtml = renderA3A4(table); break;
      case 'a5a8': editorHtml = renderA5A8(table); break;
      case 'derived':
        editorHtml = (table.id === 'A9') ? renderA9() : (table.id === 'A10') ? renderA10() : '';
        break;
      case 'bSimple': editorHtml = renderB1(table); break;
      case 'bMatrix': editorHtml = renderB2(table); break;
      case 'cDescriptive': editorHtml = renderC1(table); break;
      case 'cMatrix2': editorHtml = renderC2(table); break;
      case 'cProgram': editorHtml = renderCProgram(table); break;
      case 'dDescriptive': editorHtml = renderD1(table); break;
      case 'dCumulative': editorHtml = renderDCumulative(table); break;
      case 'eMatrix': editorHtml = renderE1(table); break;
      case 'hBoroughs': editorHtml = renderH1(table); break;
      case 'iYearTotals': editorHtml = renderI1(table); break;
      case 'jMetric': editorHtml = renderJMetric(table); break;
      case 'jSegment4': editorHtml = renderJSegment4(table); break;
      case 'jEAP7': editorHtml = renderJEAP7(table); break;
      case 'jEAP8': editorHtml = renderJEAP8(table); break;
      case 'fDescriptive': editorHtml = renderF1(table); break;
      case 'fOutages2': editorHtml = renderF2(table); break;
      case 'fSimple': editorHtml = renderF3(table); break;
      case 'fAreas': editorHtml = renderFAreas(table); break;
      case 'fAreasMixed': editorHtml = renderF6(table); break;
      case 'fOutagesDac': editorHtml = renderF7(table); break;
      case 'fBoroughs': editorHtml = renderFBoroughs(table); break;
      case 'gPercent': editorHtml = renderG1(table); break;
      case 'gCounty': editorHtml = renderGCounty(table); break;
      case 'gEmissions': editorHtml = renderG10(table); break;
      default: editorHtml = '<div class="empty-pane">Editor for ' + table.id + ' is coming soon.</div>';
    }

    area.innerHTML =
      '<div class="chart-card">' +
      '<div class="chart-card-head">' +
      '<div><h3>' + table.id + '. ' + table.title + '</h3>' +
      '<p class="chart-sub">' + table.desc + '</p></div>' +
      '<span class="chart-tag">Section ' + state.section + ' · ' + table.id + (!table.editable ? ' · DERIVED' : '') + '</span>' +
      '</div><div class="chart-body">' + editorHtml + '</div></div>';

    if (!table.editable) return;

    // Wire edits per kind
    area.querySelectorAll('.cell-edit').forEach(cell => {
      cell.addEventListener('blur', () => {
        switch (table.kind) {
          case 'a1a2': handleA1A2Edit(cell, table); break;
          case 'a3a4': handleA3Edit(cell); break;
          case 'a5a8': handleA5A8Edit(cell); break;
          case 'bSimple': handleBSimpleEdit(cell); break;
          case 'bMatrix': handleBMatrixEdit(cell); break;
          case 'cDescriptive': handleC1Edit(cell); break;
          case 'cMatrix2': handleC2Edit(cell); break;
          case 'cProgram': handleCProgramEdit(cell); break;
          case 'dDescriptive': handleD1Edit(cell); break;
          case 'dCumulative': handleDCumulativeEdit(cell); break;
          case 'eMatrix': handleE1Edit(cell); break;
          case 'hBoroughs': handleH1Edit(cell); break;
          case 'iYearTotals': handleI1Edit(cell); break;
          case 'jMetric': handleJMetricEdit(cell); break;
          case 'jSegment4': handleJSegment4Edit(cell); break;
          case 'jEAP7': handleJ7Edit(cell); break;
          case 'jEAP8': handleJ8Edit(cell); break;
          case 'fDescriptive': handleF1Edit(cell); break;
          case 'fOutages2': handleF2Edit(cell); break;
          case 'fSimple': handleF3Edit(cell); break;
          case 'fAreas': handleFAreasEdit(cell); break;
          case 'fAreasMixed': handleF6Edit(cell); break;
          case 'fOutagesDac': handleF7Edit(cell); break;
          case 'fBoroughs': handleFBoroughsEdit(cell); break;
          case 'gPercent': handleG1Edit(cell); break;
          case 'gCounty': handleGCountyEdit(cell); break;
          case 'gEmissions': handleG10Edit(cell); break;
        }
      });
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); cell.blur(); }
        if (e.key === 'Escape') { cell.blur(); renderEditor(); }
      });
    });

    // Wire add buttons (per table kind)
    const confirmBtn = document.getElementById('btn-add-program-confirm');
    if (confirmBtn) confirmBtn.addEventListener('click', handleAddProgramA1A2);

    const a5ProgBtn = area.querySelector('[data-action="add-a5-program"]');
    if (a5ProgBtn) a5ProgBtn.addEventListener('click', handleAddProgramA5A8);

    area.querySelectorAll('[data-action="add-a3"]').forEach(btn => {
      btn.addEventListener('click', () => {
        handleAddProgramA3(btn.dataset.segment, btn.closest('tr'));
      });
    });
    area.querySelectorAll('[data-action="add-measure"]').forEach(btn => {
      btn.addEventListener('click', () => {
        handleAddMeasure(btn.dataset.program, btn.closest('tr'));
      });
    });
    area.querySelectorAll('[data-action="add-c1"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddC1(btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-cprog"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddCProgram(btn.dataset.table, btn.dataset.segment, btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-d1"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddD1(btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-e1"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddE1(btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-h1"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddH1(btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-i1"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddI1(btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-jmetric"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddJMetric(btn.dataset.table, btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-f1"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddF1(btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-f3"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddF3(btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-fareas"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddFAreas(btn.dataset.table, btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-f6"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddF6(btn.closest('tr')));
    });
    area.querySelectorAll('[data-action="add-fbor"]').forEach(btn => {
      btn.addEventListener('click', () => handleAddFBoroughs(btn.dataset.table, btn.closest('tr')));
    });

    // Wire delete buttons
    area.querySelectorAll('[data-action="delete-row"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (table.kind === 'a1a2') handleDeleteRowA1A2(parseInt(btn.dataset.idx, 10));
        else if (btn.dataset.rowid) handleDeleteRowById(btn.dataset.rowid);
      });
    });
    area.querySelectorAll('[data-action="delete-measure"]').forEach(btn => {
      btn.addEventListener('click', () => {
        handleDeleteMeasure(btn.dataset.program, btn.dataset.measure);
      });
    });
  }

  function setSection(letter) {
    state.section = letter;
    const tabs = TABLES_BY_SECTION[letter] || [];
    state.table = tabs.length ? tabs[0].id : null;
    const years = getAvailableYears(letter);
    if (!years.includes(state.year)) state.year = years[0];
    document.querySelectorAll('.ingest-sec-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-letter') === letter);
    });
    renderToolbar();
    renderEditor();
  }

  // ============================================================
  // INIT
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    seedIfNeeded();
    renderToolbar();
    renderEditor();

    document.querySelectorAll('.ingest-sec-btn').forEach(btn => {
      btn.addEventListener('click', () => setSection(btn.getAttribute('data-letter')));
    });
    document.getElementById('ingest-year-select').addEventListener('change', (e) => {
      state.year = e.target.value;
      renderEditor();
    });
    document.getElementById('ingest-table-select').addEventListener('change', (e) => {
      state.table = e.target.value;
      renderEditor();
    });
    document.getElementById('btn-add-year').addEventListener('click', () => {
      document.getElementById('add-year-input').value = '';
      document.getElementById('add-year-modal').hidden = false;
      setTimeout(() => document.getElementById('add-year-input').focus(), 50);
    });
    document.getElementById('add-year-cancel').addEventListener('click', () => {
      document.getElementById('add-year-modal').hidden = true;
    });
    document.getElementById('add-year-confirm').addEventListener('click', handleAddYearConfirm);
    document.getElementById('btn-delete-year').addEventListener('click', handleDeleteYear);
  });
})();
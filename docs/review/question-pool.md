# Question pool review

Taipei has 25 questions at 25 distinct places and coordinates for 20 existing Guess the price entries. Hong Kong, Singapore and Macau still have their earlier research rows and pending CE1 inventories. All new Taipei rows are drafts.

## Taipei

The Taipei 101 Landmark Waypost is at **25.033667, 121.564810** (migration `20261110064954`). **13 of 25** question pins fall within 1.5 km by great-circle distance. The remaining 12 are within the Taipei rectangle in [the map coverage GeoJSON](../design/public-sea-cities.geojson). The original Xiangshan Park, Daan Forest Park and Dajia Riverside Park candidates retain their checked path points.

Each pin was checked against OpenStreetMap for a mapped pedestrian way at the place or its outdoor approach. Point geometry was checked against the way and nearby mapped buildings, private areas, schools, active military and sacred sites. Map geometry and access tags come from [OpenStreetMap contributors, ODbL](https://www.openstreetmap.org/copyright). These are desk checks of mapped access.

The seed uses HL-C3’s zero-based numeric `answer` for choices and a short English `answer` plus a flat bilingual `typed_aliases` list for typed questions. Text answers in the table show the canonical Traditional Chinese and English forms. The stable quiz facts need only the normal six-month review.

| ID | Place | Type | Question (zh / en) | Answer (zh / en) | Location | Landmark distance | Fact source and checked date | Photo credit |
|---|---|---|---|---|---|---:|---|---|
| taipei-001 | 台北101 / Taipei 101 | choice | 台北101的建築高度是多少？ / How tall is Taipei 101? | 508公尺 / 508 metres | [OSM way/1339499092](https://www.openstreetmap.org/way/1339499092) · 25.0347425, 121.5643983 | 127 m | [Source](https://travel.taipei/en/pictorial/article/48476) · 2026-11-18 | — |
| taipei-002 | 四四南村 / Four Four South Village | choice | 四四南村原本是哪一類聚落？ / What kind of settlement was Four Four South Village originally? | 軍人及其眷屬的住宅聚落 / Housing for military families | [OSM way/373793584](https://www.openstreetmap.org/way/373793584) · 25.0314718, 121.5619104 | 381 m | [Source](https://travel.taipei/zh-tw/media/audio-guide/details/409) · 2026-11-18 | — |
| taipei-003 | 象山觀景平台 / Xiangshan Boulder Lookout | choice | 象山這處觀景平台旁有一組著名的大石，共有幾塊？ / How many boulders make up the famous group beside this Xiangshan lookout? | 六塊 / Six | [OSM way/1237332592](https://www.openstreetmap.org/way/1237332592) · 25.0269102, 121.5741282 | 1202 m | [Source](https://www.travel.taipei/en/pictorial/article/18240/) · 2026-11-18 | — |
| taipei-004 | 松山文創園區 / Songshan Cultural and Creative Park | choice | 松山文創園區的前身主要生產什麼？ / What did the factory that became Songshan Cultural and Creative Park make? | 香菸 / Cigarettes | [OSM way/229056581](https://www.openstreetmap.org/way/229056581) · 25.0441719, 121.5604507 | 1248 m | [Source](https://www.travel.taipei/en/attraction/details/586) · 2026-11-18 | — |
| taipei-005 | 臺北大巨蛋 / Taipei Dome | choice | 臺北大巨蛋的主要球場是為哪種運動設計的？ / What sport was the main playing field at Taipei Dome designed for? | 棒球 / Baseball | [OSM way/431945126](https://www.openstreetmap.org/way/431945126) · 25.0415740, 121.5591460 | 1048 m | [Source](https://www.taipeidome.com.tw/Web/Dome/AboutThePark_717295311738896384/) · 2026-11-18 | — |
| taipei-006 | 幾米月亮公車 / Jimmy’s Moon Bus | text | 幾米月亮公車裡，坐在駕駛座的是哪種動物？ / What kind of animal is in the driver’s seat of Jimmy’s Moon Bus? | 熊 / bear | [OSM way/1537742063](https://www.openstreetmap.org/way/1537742063) · 25.0327766, 121.5656560 | 131 m | [Source](https://www.travel.taipei/file/2296/) · 2026-11-18 | — |
| taipei-007 | 台北世貿一館 / Taipei World Trade Center Exhibition Hall 1 | choice | 台北世貿一館地面以上共有幾層？ / How many floors above ground does Taipei World Trade Center Exhibition Hall 1 have? | 七層 / Seven | [OSM way/136814868](https://www.openstreetmap.org/way/136814868) · 25.0347109, 121.5619098 | 314 m | [Source](https://twtc.org.tw/en/about) · 2026-11-18 | — |
| taipei-008 | 香堤大道廣場 / Xiangti Avenue Square | choice | 臺北市公園處介紹香堤大道廣場時，特別提到哪種行道樹？ / Which tree does Taipei’s parks department highlight along Xiangti Avenue Square? | 櫸木 / Zelkova | [OSM way/1340087848](https://www.openstreetmap.org/way/1340087848) · 25.0374527, 121.5670165 | 476 m | [Source](https://travel.taipei/zh-tw/news/details/62359) · 2026-11-18 | — |
| taipei-009 | 永春崗公園 / Yongchunggang Park | choice | 永春崗公園遊戲場的設計以當地哪一段歷史為靈感？ / What part of local history inspired the playground design at Yongchunggang Park? | 採煤 / Coal mining | [OSM way/1341564303](https://www.openstreetmap.org/way/1341564303) · 25.0312531, 121.5768601 | 1243 m | [Source](https://ppfcc.org/park/p0089/) · 2026-11-18 | — |
| taipei-010 | 彩虹起跑線 / Rainbow Starting Line | text | 市民廣場的這道彩虹地景，把長條形的彩虹比作飛機起降的什麼？ / What aircraft feature does the long strip of colour at this public artwork resemble? | 跑道 / runway | [OSM way/309157018](https://www.openstreetmap.org/way/309157018) · 25.0377059, 121.5632301 | 476 m | [Source](https://travel.taipei/en/attraction/details/2366) · 2026-11-18 | — |
| taipei-011 | 國立國父紀念館 / National Sun Yat-sen Memorial Hall | text | 誰設計了國立國父紀念館？ / Who designed the National Sun Yat-sen Memorial Hall? | 王大閎 / Wang Dahong | [OSM way/49153748](https://www.openstreetmap.org/way/49153748) · 25.0380703, 121.5579780 | 845 m | [Source](https://travel.taipei/en/attraction/details/446/) · 2026-11-18 | — |
| taipei-012 | 象山公園 / Xiangshan Park | choice | 象山公園的所在地以前是什麼用途？ / What was the site of Xiangshan Park previously used for? | 軍事靶場 / A military firing range | [OSM way/319526552](https://www.openstreetmap.org/way/319526552) · 25.0301894, 121.5702748 | 673 m | [Source](https://www.travel.taipei/en/attraction/details/703/) · 2026-11-18 | — |
| taipei-013 | 臺北市議會 / Taipei City Council | choice | 臺北市議會在哪一年遷到信義區現址？ / In what year did Taipei City Council move to its current site in Xinyi? | 1990年 / 1990 | [OSM way/1376754788](https://www.openstreetmap.org/way/1376754788) · 25.0390656, 121.5623217 | 651 m | [Source](https://www.cna.com.tw/news/aloc/201709050245.aspx) · 2026-11-18 | — |
| taipei-014 | 大安森林公園 / Daan Forest Park | choice | 大安森林公園的生態池有幾座人工島？ / How many artificial islands are in Daan Forest Park’s ecological pond? | 兩座 / Two | [OSM way/49195976](https://www.openstreetmap.org/way/49195976) · 25.0312408, 121.5364940 | 2866 m | [Source](https://www.travel.taipei/en/pictorial/article/57704) · 2026-11-18 | — |
| taipei-015 | 大佳河濱公園 / Dajia Riverside Park | text | 大佳河濱公園沿著哪一條河流？ / Which river runs alongside Dajia Riverside Park? | 基隆河 / Keelung River | [OSM way/354318668](https://www.openstreetmap.org/way/354318668) · 25.0757169, 121.5331829 | 5658 m | [Source](https://travel.taipei/en/attraction/details/602) · 2026-11-18 | — |
| taipei-016 | 二二八和平公園 / 228 Peace Park | choice | 二二八和平公園以前叫什麼名字？ / What was 228 Peace Park formerly called? | 臺北新公園 / Taipei New Park | [OSM way/784696787](https://www.openstreetmap.org/way/784696787) · 25.0430687, 121.5141308 | 5212 m | [Source](https://www.travel.taipei/zh-tw/news/details/26895/) · 2026-11-18 | — |
| taipei-017 | 國立中正紀念堂 / Chiang Kai-shek Memorial Hall | choice | 中正紀念堂主體建築的藍色屋頂呈什麼形狀？ / What shape is the blue roof of the main Chiang Kai-shek Memorial Hall? | 八角形 / Octagon | [OSM way/1053359168](https://www.openstreetmap.org/way/1053359168) · 25.0351920, 121.5208950 | 4428 m | [Source](https://travel.taipei/en/media/audio-guide/details/37) · 2026-11-18 | — |
| taipei-018 | 美堤河濱公園 / Meiti Riverside Park | choice | 美堤河濱公園的規劃始於哪項河川工程？ / What type of river engineering set the stage for Meiti Riverside Park? | 截彎取直 / Straightening a river bend | [OSM way/1056884091](https://www.openstreetmap.org/way/1056884091) · 25.0754210, 121.5593166 | 4676 m | [Source](https://www.travel.taipei/en/attraction/details/2390) · 2026-11-18 | — |
| taipei-019 | 彩虹河濱公園 / Rainbow Riverside Park | choice | 彩虹河濱公園位於中山高速公路與哪座橋之間？ / Rainbow Riverside Park lies between Sun Yat-Sen Freeway and which bridge? | 麥帥一橋 / First MacArthur Bridge | [OSM way/1070592915](https://www.openstreetmap.org/way/1070592915) · 25.0556800, 121.5722262 | 2559 m | [Source](https://www.travel.taipei/en/attraction/details/2013/) · 2026-11-18 | — |
| taipei-020 | 華山1914文化創意產業園區 / Huashan 1914 Creative Park | text | 華山1914在成為文創園區以前，是哪一種工廠？ / What kind of factory occupied Huashan 1914 before it became a creative park? | 酒廠 / winery | [OSM way/1307758123](https://www.openstreetmap.org/way/1307758123) · 25.0441558, 121.5298235 | 3713 m | [Source](https://travel.taipei/en/attraction/details/515) · 2026-11-18 | — |
| taipei-021 | 花博公園圓山園區 / Taipei Expo Park Yuanshan Area | choice | 花博公園圓山園區曾是哪一場博覽會的展區？ / Which exhibition used the Yuanshan site now occupied by Taipei Expo Park? | 臺北國際花卉博覽會 / Taipei International Flora Expo | [OSM way/24836053](https://www.openstreetmap.org/way/24836053) · 25.0706847, 121.5216890 | 5984 m | [Source](https://travel.taipei/en/pictorial/article/65930) · 2026-11-18 | — |
| taipei-022 | 臺北中山堂 / Taipei Zhongshan Hall | choice | 臺北中山堂一樓的主要廳堂曾是哪個機構的集會場所？ / Which body once met in the main ground-floor hall of Taipei Zhongshan Hall? | 國民大會 / National Assembly | [OSM way/1347529884](https://www.openstreetmap.org/way/1347529884) · 25.0438644, 121.5105362 | 5584 m | [Source](https://travel.taipei/en/media/audio-guide/details/57) · 2026-11-18 | — |
| taipei-023 | 富陽自然生態公園 / Fuyang Eco Park | choice | 富陽自然生態公園的前身是哪種軍事設施？ / What kind of military facility formerly occupied the site of Fuyang Eco Park? | 彈藥庫 / An ammunition depot | [OSM way/1460554840](https://www.openstreetmap.org/way/1460554840) · 25.0171204, 121.5563748 | 2027 m | [Source](https://www.travel.taipei/en/attraction/details/618/) · 2026-11-18 | — |
| taipei-024 | 興隆公園 / Xinglong Park | choice | 興隆公園湖中的橋是什麼造型？ / What is the shape of the bridge in Xinglong Park’s lake? | 拱形 / Arch | [OSM way/253358885](https://www.openstreetmap.org/way/253358885) · 25.0000005, 121.5510798 | 3991 m | [Source](https://travel.taipei/en/attraction/details/634/) · 2026-11-18 | — |
| taipei-025 | 國立臺灣博物館本館 / National Taiwan Museum Main Building | choice | 國立臺灣博物館本館所在的這棟建築是哪一年落成的？ / In what year was the National Taiwan Museum’s current main building completed? | 1915年 / 1915 | [OSM way/79606900](https://www.openstreetmap.org/way/79606900) · 25.0431300, 121.5150070 | 5127 m | [Source](https://eng.taiwan.net.tw/m1.aspx?id=5955&print=1&sNo=0002090+) · 2026-11-18 | — |

### Taipei CE1 price locations

Match these rows to the existing CE1 seed using `city` and `ce1_seq`. The price data and price check dates carry forward from that seed. Recheck prices before using them in a new rotation. Shared venues reuse their documented outdoor approach where applicable. The zoo shuttle train and the Ferris wheel sit beyond paid gates, so their pins are on the public side of their respective entrances. Use the office-tower approach for the Taipei 101 Observatory while the operator directs visitors there.

| CE1 seq | Named place (zh / en) | Public outdoor approach | Location | Venue location source and checked date |
|---|---|---|---|---|
| 1 | 春水堂南西店，中山區，台北 / Chun Shui Tang SKM Nanxi, Zhongshan, Taipei | Street sidewalk outside SKM Nanxi Building 1 | [OSM way/542684698](https://www.openstreetmap.org/way/542684698) · 25.0523845, 121.5211033 | [Location source](https://www.chunshuitang.com.tw/en/) · 2026-11-18 |
| 2 | 微熱山丘民生公園店，松山區，台北 / SunnyHills Minsheng Park, Songshan, Taipei | Sidewalk outside the shop courtyard | [OSM way/1471704243](https://www.openstreetmap.org/way/1471704243) · 25.0577523, 121.5571311 | [Location source](https://www.sunnyhills.com.tw/store/zh-tw/shop/f44dd8c1-d53c-40d2-a1e2-d03b5a794a54) · 2026-11-18 |
| 3 | 鼎泰豐台北101店，信義區，台北 / Din Tai Fung Taipei 101, Xinyi, Taipei | Outside the Taipei 101 mall near the B1 branch | [OSM way/1339499085](https://www.openstreetmap.org/way/1339499085) · 25.0334669, 121.5644527 | [Location source](https://www.dintaifung.com.tw/eng/store.php?cid=1) · 2026-11-18 |
| 4 | 臺北市立動物園售票處，文山區，台北 / Taipei Zoo ticket office, Wenshan, Taipei | Public approach to the zoo’s main gate | [OSM way/440124347](https://www.openstreetmap.org/way/440124347) · 24.9982412, 121.5819253 | [Location source](https://english.zoo.gov.taipei/News_Content.aspx?n=1C101BB74EA31928&s=5DD855A30ABF5861&sms=F6417076988132FF) · 2026-11-18 |
| 5 | 貓空纜車動物園站售票處，文山區，台北 / Maokong Gondola Taipei Zoo Station, Wenshan, Taipei | Sidewalk by the gondola terminal | [OSM way/657396299](https://www.openstreetmap.org/way/657396299) · 24.9962432, 121.5763427 | [Location source](https://gondolaticket.metro.taipei/gondolaticket/) · 2026-11-18 |
| 7 | 臺北捷運台北車站詢問處，中正區，台北 / Taipei Metro information counter, Taipei Main Station, Zhongzheng | Ground-level sidewalk near the MRT entrances | [OSM way/1559040563](https://www.openstreetmap.org/way/1559040563) · 25.0466167, 121.5176068 | [Location source](https://web.metro.taipei/pages2026/WebStation/051) · 2026-11-18 |
| 9 | 台北101觀景台售票處，信義區，台北 / Taipei 101 Observatory ticket office, Xinyi, Taipei | Outdoor approach to the office tower ticket counter | [OSM way/1339499083](https://www.openstreetmap.org/way/1339499083) · 25.0333555, 121.5649073 | [Location source](https://www.taipei-101.com.tw/tw/observatory) · 2026-11-18 |
| 11 | 台北當代藝術館售票處，大同區，台北 / MOCA Taipei ticket office, Datong, Taipei | Outdoor approach at the museum plaza | [OSM way/251731717](https://www.openstreetmap.org/way/251731717) · 25.0504894, 121.5190682 | [Location source](https://www.moca.taipei/en/Visit/Getting%20Here) · 2026-11-18 |
| 12 | 台灣高鐵台北車站售票處，中正區，台北 / THSR ticket office, Taipei Main Station, Zhongzheng | Ground-level pedestrian approach at Taipei Main Station south side | [OSM way/1565404787](https://www.openstreetmap.org/way/1565404787) · 25.0468505, 121.5171029 | [Location source](https://en.thsrc.com.tw/ArticleContent/53156954-1528-461f-af8b-54c517a435a4) · 2026-11-18 |
| 13 | 春水堂南西店，中山區，台北 / Chun Shui Tang SKM Nanxi, Zhongshan, Taipei | Street sidewalk outside SKM Nanxi Building 1 | [OSM way/542684698](https://www.openstreetmap.org/way/542684698) · 25.0523845, 121.5211033 | [Location source](https://www.chunshuitang.com.tw/en/) · 2026-11-18 |
| 14 | 臺北戲棚售票處，中山區，台北 / TaipeiEYE box office, Zhongshan, Taipei | Public sidewalk on the TaipeiEYE side of Zhongshan North Road | [OSM way/724232243](https://www.openstreetmap.org/way/724232243) · 25.0610017, 121.5231307 | [Location source](https://www.taipeieye.com/en/location/) · 2026-11-18 |
| 15 | 鼎泰豐台北101店，信義區，台北 / Din Tai Fung Taipei 101, Xinyi, Taipei | Outside the Taipei 101 mall near the B1 branch | [OSM way/1339499085](https://www.openstreetmap.org/way/1339499085) · 25.0334669, 121.5644527 | [Location source](https://www.dintaifung.com.tw/eng/store.php?cid=1) · 2026-11-18 |
| 16 | 臺北市立動物園遊客列車總站，文山區，台北 / Taipei Zoo shuttle train main stop, Wenshan, Taipei | Public side of the zoo entrance for the gated shuttle train main stop | [OSM way/1346843043](https://www.openstreetmap.org/way/1346843043) · 24.9983215, 121.5821923 | [Location source](https://english.zoo.gov.taipei/cp.aspx?n=26f8019ce6d17786) · 2026-11-18 |
| 17 | 鼎泰豐台北101店，信義區，台北 / Din Tai Fung Taipei 101, Xinyi, Taipei | Outside the Taipei 101 mall near the B1 branch | [OSM way/1339499085](https://www.openstreetmap.org/way/1339499085) · 25.0334669, 121.5644527 | [Location source](https://www.dintaifung.com.tw/eng/store.php?cid=1) · 2026-11-18 |
| 18 | 春水堂南西店，中山區，台北 / Chun Shui Tang SKM Nanxi, Zhongshan, Taipei | Street sidewalk outside SKM Nanxi Building 1 | [OSM way/542684698](https://www.openstreetmap.org/way/542684698) · 25.0523845, 121.5211033 | [Location source](https://www.chunshuitang.com.tw/en/) · 2026-11-18 |
| 19 | 春水堂南西店，中山區，台北 / Chun Shui Tang SKM Nanxi, Zhongshan, Taipei | Street sidewalk outside SKM Nanxi Building 1 | [OSM way/542684698](https://www.openstreetmap.org/way/542684698) · 25.0523845, 121.5211033 | [Location source](https://www.chunshuitang.com.tw/en/) · 2026-11-18 |
| 20 | 春水堂南西店，中山區，台北 / Chun Shui Tang SKM Nanxi, Zhongshan, Taipei | Street sidewalk outside SKM Nanxi Building 1 | [OSM way/542684698](https://www.openstreetmap.org/way/542684698) · 25.0523845, 121.5211033 | [Location source](https://www.chunshuitang.com.tw/en/) · 2026-11-18 |

### Taipei CE1 locations outside map coverage

Retain these real locations with `outside_coverage: true` and exclude them from quest pin selection.

| CE1 seq | Named place (zh / en) | Public outdoor approach | Location | Venue location source and checked date |
|---|---|---|---|---|
| 6 | 臺北天文館售票處，士林區，台北 / Taipei Astronomical Museum ticket office, Shilin, Taipei | Pedestrian approach to the museum | [OSM way/137324319](https://www.openstreetmap.org/way/137324319) · 25.0959909, 121.5177737 | [Location source](https://tam.gov.taipei/cp.aspx?n=1FBCE6F417E8A9F7) · 2026-11-18 |
| 8 | 臺北兒童新樂園摩天輪，士林區，台北 / Taipei Children’s Amusement Park Ferris wheel, Shilin, Taipei | Public side of amusement park entrance for the gated Ferris wheel | [OSM way/1346846075](https://www.openstreetmap.org/way/1346846075) · 25.0966999, 121.5153932 | [Location source](https://english.tcap.taipei/cp.aspx?n=244A93049FE0079E) · 2026-11-18 |
| 10 | 國立故宮博物院北院第一展覽館，士林區，台北 / National Palace Museum Northern Branch, Exhibition Hall I, Shilin, Taipei | Pedestrian forecourt of the main exhibition building | [OSM way/244450380](https://www.openstreetmap.org/way/244450380) · 25.1018105, 121.5487377 | [Location source](https://www.npm.gov.tw/Articles.aspx?sno=02007001) · 2026-11-18 |

## hong-kong

| ID | Place | Question (zh / en) | Answer (zh / en) | Source | Checked | Photo credit |
|---|---|---|---|---|---|---|
| hong-kong-001 | 香港科技大學紅鳥日晷 / HKUST Red Bird Sundial | 科大紅鳥雕塑具備哪種計時器的功能？ / What type of timepiece does HKUST’s Red Bird sculpture function as? | 日晷 / Sundial | [Official source](https://cmo.hkust.edu.hk/sundial-sculpture) | 2026-11-18 | None |
| hong-kong-002 | 香港科技大學紅鳥日晷 / HKUST Red Bird Sundial | 科大紅鳥日晷主要由什麼材料製成？ / What is the HKUST Red Bird sundial made of? | 鋼 / Steel | [Official source](https://cmo.hkust.edu.hk/sundial-sculpture) | 2026-11-18 | None |
| hong-kong-003 | 香港科技大學紅鳥日晷 / HKUST Red Bird Sundial | 科大紅鳥日晷是哪一年安裝的？ / In which year was the HKUST Red Bird sundial installed? | 1991 / 1991 | [Official source](https://cmo.hkust.edu.hk/sundial-sculpture) | 2026-11-18 | None |
| hong-kong-004 | 香港科技大學紅鳥日晷 / HKUST Red Bird Sundial | 科大紅鳥日晷基座的浮雕描繪了多少項中國科技成就？ / How many Chinese science and technology achievements are depicted in the Red Bird podium mural? | 39項 / 39 | [Official source](https://cmo.hkust.edu.hk/sundial-sculpture) | 2026-11-18 | None |
| hong-kong-005 | 香港科技大學紅鳥日晷 / HKUST Red Bird Sundial | 科大紅鳥雕塑會利用太陽光發揮哪種計時器的功能？ / What type of timepiece does the HKUST Red Bird sculpture use sunlight to function as? | 日晷 / sundial | [Official source](https://cmo.hkust.edu.hk/sundial-sculpture) | 2026-11-18 | None |

## singapore

| ID | Place | Question (zh / en) | Answer (zh / en) | Source | Checked | Photo credit |
|---|---|---|---|---|---|---|
| singapore-001 | 魚尾獅公園 / Merlion Park | 魚尾獅公園的魚尾獅頭部是哪種動物？ / What animal forms the head of the Merlion at Merlion Park? | 獅子 / Lion | [Official source](https://www.visitsingapore.com/de_de/neighbourhood/featured-neighbourhood/marina-bay/merlion-park/) | 2026-11-18 | None |
| singapore-002 | 魚尾獅公園 / Merlion Park | 魚尾獅公園的魚尾獅身體象徵新加坡昔日的什麼？ / What does the Merlion’s fish body represent about Singapore’s past? | 漁村 / A fishing village | [Official source](https://www.visitsingapore.com/de_de/neighbourhood/featured-neighbourhood/marina-bay/merlion-park/) | 2026-11-18 | None |
| singapore-003 | 魚尾獅公園 / Merlion Park | 魚尾獅公園的主魚尾獅雕像約有多高？ / Approximately how tall is the main Merlion statue at Merlion Park? | 8.6公尺 / 8.6 metres | [Official source](https://www.visitsingapore.com/de_de/neighbourhood/featured-neighbourhood/marina-bay/merlion-park/) | 2026-11-18 | None |
| singapore-004 | 魚尾獅公園 / Merlion Park | 魚尾獅公園的主魚尾獅雕像在哪一年揭幕？ / In which year was the main Merlion statue unveiled? | 1972 / 1972 | [Official source](https://www.visitsingapore.com/de_de/neighbourhood/featured-neighbourhood/marina-bay/merlion-park/) | 2026-11-18 | None |
| singapore-005 | 魚尾獅公園 / Merlion Park | 魚尾獅公園的魚尾獅頭部是哪種動物？ / What animal forms the Merlion’s head at Merlion Park? | 獅子 / lion | [Official source](https://www.visitsingapore.com/de_de/neighbourhood/featured-neighbourhood/marina-bay/merlion-park/) | 2026-11-18 | None |

## macau

| ID | Place | Question (zh / en) | Answer (zh / en) | Source | Checked | Photo credit |
|---|---|---|---|---|---|---|
| macau-001 | 議事亭前地 / Senado Square | 議事亭前地旁的民政總署大樓最初建於哪一年？ / In what year was the former Leal Senado Building by Senado Square originally built? | 1784 / 1784 | [Official source](https://www.wh.mo/en/site/detail/11) | 2026-11-18 | None |
| macau-002 | 議事亭前地 / Senado Square | 議事亭前地旁的民政總署大樓採用哪種建築風格？ / What architectural style is the former Leal Senado Building by Senado Square? | 新古典主義 / Neoclassical | [Official source](https://www.wh.mo/en/site/detail/11) | 2026-11-18 | None |
| macau-003 | 議事亭前地 / Senado Square | 議事亭前地旁的民政總署大樓背後有什麼？ / What lies at the back of the former Leal Senado Building by Senado Square? | 庭院花園 / A courtyard garden | [Official source](https://www.wh.mo/en/site/detail/11) | 2026-11-18 | None |
| macau-004 | 議事亭前地 / Senado Square | 議事亭前地旁的民政總署大樓正門兩側有哪種柱子？ / What kind of columns flank the entrance of the former Leal Senado Building by Senado Square? | 花崗岩多立克柱 / Granite Doric columns | [Official source](https://www.wh.mo/en/site/detail/11) | 2026-11-18 | None |
| macau-005 | 議事亭前地 / Senado Square | 議事亭前地旁的民政總署大樓最初建於哪一年？請輸入四位數字。 / In what year was the former Leal Senado Building by Senado Square originally built? Enter four digits. | 1784 / 1784 | [Official source](https://www.wh.mo/en/site/detail/11) | 2026-11-18 | None |

## Pending CE1 locations in the other cities

### hongkong

| CE1 sequence | Named place (zh / en) | Location verification |
|---|---|---|
| 1 | 海景嘉福洲際酒店 Café on M，尖沙咀東，香港 / Café on M, InterContinental Grand Stanford, Tsim Sha Tsui East, Hong Kong | Pending |
| 2 | 香港電車西港城總站，上環，香港 / Hong Kong Tramways Western Market Terminus, Sheung Wan, Hong Kong | Pending |
| 3 | 天星小輪灣仔碼頭，灣仔，香港 / Star Ferry, Wan Chai Pier, Hong Kong | Pending |
| 4 | 機場快綫香港站，中環，香港 / Airport Express Hong Kong Station, Central, Hong Kong | Pending |
| 5 | 昂坪360東涌纜車站售票處，東涌，香港 / Ngong Ping 360 Tung Chung Terminal ticket office, Tung Chung, Hong Kong | Pending |
| 6 | 香港故宮文化博物館售票處，西九文化區，香港 / Hong Kong Palace Museum ticket office, West Kowloon Cultural District | Pending |
| 7 | M+博物館售票處，西九文化區，香港 / M+ ticket office, West Kowloon Cultural District | Pending |
| 8 | 金輝點心，灣仔，香港 / Kam Fai Dim Sum, Wan Chai, Hong Kong | Pending |
| 9 | 海景嘉福洲際酒店 Café on M，尖沙咀東，香港 / Café on M, InterContinental Grand Stanford, Tsim Sha Tsui East, Hong Kong | Pending |
| 10 | 香港科學館售票處，尖沙咀東，香港 / Hong Kong Science Museum ticket office, Tsim Sha Tsui East, Hong Kong | Pending |
| 11 | 香港太空館天象廳售票處，尖沙咀，香港 / Hong Kong Space Museum Space Theatre box office, Tsim Sha Tsui | Pending |
| 12 | 金輝點心，灣仔，香港 / Kam Fai Dim Sum, Wan Chai, Hong Kong | Pending |
| 13 | 海景嘉福洲際酒店 Café on M，尖沙咀東，香港 / Café on M, InterContinental Grand Stanford, Tsim Sha Tsui East, Hong Kong | Pending |
| 14 | 金輝點心，灣仔，香港 / Kam Fai Dim Sum, Wan Chai, Hong Kong | Pending |
| 15 | 海景嘉福洲際酒店 Café on M，尖沙咀東，香港 / Café on M, InterContinental Grand Stanford, Tsim Sha Tsui East, Hong Kong | Pending |
| 16 | 金輝點心，灣仔，香港 / Kam Fai Dim Sum, Wan Chai, Hong Kong | Pending |
| 17 | 金輝點心，灣仔，香港 / Kam Fai Dim Sum, Wan Chai, Hong Kong | Pending |
| 18 | 金輝點心，灣仔，香港 / Kam Fai Dim Sum, Wan Chai, Hong Kong | Pending |
| 19 | 金輝點心，灣仔，香港 / Kam Fai Dim Sum, Wan Chai, Hong Kong | Pending |
| 20 | 山頂纜車中環花園道總站售票處，中環，香港 / Peak Tram Lower Terminus ticket office, Garden Road, Central | Pending |

### singapore

| CE1 sequence | Named place (zh / en) | Location verification |
|---|---|---|
| 1 | 馬來西亞美食街，聖淘沙名勝世界，新加坡 / Malaysian Food Street, Resorts World Sentosa, Singapore | Pending |
| 2 | 馬來西亞美食街，聖淘沙名勝世界，新加坡 / Malaysian Food Street, Resorts World Sentosa, Singapore | Pending |
| 3 | 國家胡姬花園售票處，東陵，新加坡 / National Orchid Garden ticket counter, Tanglin, Singapore | Pending |
| 4 | 新加坡動物園售票處，萬態，新加坡 / Singapore Zoo ticket office, Mandai, Singapore | Pending |
| 5 | 新加坡國家博物館售票處，史丹福路，新加坡 / National Museum of Singapore ticket office, Stamford Road, Singapore | Pending |
| 6 | 土生文化館售票處，亞美尼亞街，新加坡 / Peranakan Museum ticket office, Armenian Street, Singapore | Pending |
| 7 | 樟宜機場地鐵站第二航廈票務服務中心，樟宜，新加坡 / SimplyGo ticket office, Changi Airport MRT Terminal 2, Changi | Pending |
| 8 | 新加坡纜車花柏山站售票處，花柏山，新加坡 / Singapore Cable Car Mount Faber ticket office, Mount Faber | Pending |
| 9 | 新加坡摩天觀景輪售票處，濱海中心，新加坡 / Singapore Flyer ticket office, Marina Centre, Singapore | Pending |
| 10 | 新加坡國家美術館售票處，市政區，新加坡 / National Gallery Singapore ticket counter, Civic District | Pending |
| 11 | 時光之翼售票處，西樂索海灘，聖淘沙 / Wings of Time ticket office, Siloso Beach, Sentosa, Singapore | Pending |
| 12 | 馬來西亞美食街，聖淘沙名勝世界，新加坡 / Malaysian Food Street, Resorts World Sentosa, Singapore | Pending |
| 13 | 河川生態園售票處，萬態，新加坡 / River Wonders ticket office, Mandai, Singapore | Pending |
| 14 | 新加坡摩天觀景輪售票處，濱海中心，新加坡 / Singapore Flyer ticket office, Marina Centre, Singapore | Pending |
| 15 | 馬來西亞美食街，聖淘沙名勝世界，新加坡 / Malaysian Food Street, Resorts World Sentosa, Singapore | Pending |
| 16 | 馬來西亞美食街，聖淘沙名勝世界，新加坡 / Malaysian Food Street, Resorts World Sentosa, Singapore | Pending |
| 17 | 夜間野生動物園售票處，萬態，新加坡 / Night Safari ticket office, Mandai, Singapore | Pending |
| 18 | 馬來西亞美食街，聖淘沙名勝世界，新加坡 / Malaysian Food Street, Resorts World Sentosa, Singapore | Pending |
| 19 | 馬來西亞美食街，聖淘沙名勝世界，新加坡 / Malaysian Food Street, Resorts World Sentosa, Singapore | Pending |
| 20 | Durian 36，芽籠路，新加坡 / Durian 36, Geylang Road, Singapore | Pending |

### macau

| CE1 sequence | Named place (zh / en) | Location verification |
|---|---|---|
| 1 | 安德魯咖啡店，路環，澳門 / Lord Stow’s Café, Coloane, Macau | Pending |
| 2 | 安德魯咖啡店，路環，澳門 / Lord Stow’s Café, Coloane, Macau | Pending |
| 3 | 澳門大賽車博物館售票處，新口岸，澳門 / Macao Grand Prix Museum ticket office, NAPE, Macau | Pending |
| 4 | 澳門輕軌媽閣站售票機，媽閣，澳門 / Macao LRT Barra Station ticket machines, Barra, Macau | Pending |
| 5 | 松山纜車二龍喉公園售票處，望德堂區，澳門 / Guia Cable Car ticket office, Flora Garden, São Lázaro, Macau | Pending |
| 6 | 澳門旅遊塔觀光層售票處，南灣，澳門 / Macau Tower observation deck ticket office, Nam Van, Macau | Pending |
| 7 | 澳門君悅酒店大堂酒廊，路氹，澳門 / Grand Hyatt Macau Lobby Lounge, Cotai, Macau | Pending |
| 8 | 銀河氹仔漁村，路氹，澳門 / Tam Chai Yu Chun, Galaxy Macau, Cotai | Pending |
| 9 | 安德魯咖啡店，路環，澳門 / Lord Stow’s Café, Coloane, Macau | Pending |
| 10 | 澳門博物館售票處，大炮台，澳門 / Macao Museum ticket office, Mount Fortress, Macau | Pending |
| 11 | 澳門君悅酒店大堂酒廊，路氹，澳門 / Grand Hyatt Macau Lobby Lounge, Cotai, Macau | Pending |
| 12 | 銀河氹仔漁村，路氹，澳門 / Tam Chai Yu Chun, Galaxy Macau, Cotai | Pending |
| 13 | 林則徐紀念館售票處，蓮峰廟，澳門 / Lin Zexu Memorial Museum ticket office, Lin Fung Temple, Macau | Pending |
| 14 | 銀河氹仔漁村，路氹，澳門 / Tam Chai Yu Chun, Galaxy Macau, Cotai | Pending |
| 15 | 仁慈堂博物館售票處，議事亭前地，澳門 / Holy House of Mercy Museum ticket office, Senado Square, Macau | Pending |
| 16 | 銀河氹仔漁村，路氹，澳門 / Tam Chai Yu Chun, Galaxy Macau, Cotai | Pending |
| 17 | 新濠影滙影滙之星售票處，路氹，澳門 / Studio City Golden Reel ticket office, Cotai, Macau | Pending |
| 18 | 新濠影滙香滿樓，路氹，澳門 / Spice Road, Studio City, Cotai, Macau | Pending |
| 19 | 新濠影滙香滿樓，路氹，澳門 / Spice Road, Studio City, Cotai, Macau | Pending |
| 20 | 銀河氹仔漁村，路氹，澳門 / Tam Chai Yu Chun, Galaxy Macau, Cotai | Pending |

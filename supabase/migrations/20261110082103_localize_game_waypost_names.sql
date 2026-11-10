-- Restore Traditional Chinese Waypost names where the path seed copied the
-- English OSM name into name_zh. Source park/way/relation tags were checked
-- against OSM on 2026-11-10; unnamed "Public park" rows use the generic 公園.
-- Preserve name_en, geometry, source_ref, game rules and every other shore.
with fixes(city_zh, old_name, new_name) as (values
  ('台北', '228 Peace Park', '二二八和平公園'),
  ('台北', 'Da-an Forest Park', '大安森林公園'),
  ('台北', 'Dajia Park', '大佳河濱公園'),
  ('台北', 'Democracy Boulevard', '民主大道'),
  ('台北', 'Meiti Riverside Park', '美堤河濱公園'),
  ('台北', 'Sōngshòu Square Park', '松壽廣場'),
  ('台北', 'Taipei Civic Square', '台北市民廣場'),
  ('台北', 'Xiangshan Park', '象山公園'),
  ('台北', 'Xinyi Square', '信義廣場'),
  ('台北', 'Yingfeng Riverside Park', '迎風河濱公園'),
  ('台北', 'Yongchunggang Park', '永春崗公園'),
  ('台北', 'Zhongshan Park', '中山公園'),
  ('台北', 'Zhongzheng Memorial Park', '中正紀念公園'),
  ('新加坡', 'Esplanade Park', '海濱公園'),
  ('新加坡', 'Fort Canning Park', '福康寧公園'),
  ('新加坡', 'Gardens by the Bay', '濱海灣花園'),
  ('新加坡', 'Kallang Riverside Park East', '加冷河濱公園東區'),
  ('新加坡', 'Kallang Riverside Park North', '加冷河濱公園北區'),
  ('新加坡', 'Merlion Park', '魚尾獅公園'),
  ('新加坡', 'Public park', '公園'),
  ('新加坡', 'Raffles Place Park', '萊佛士坊公園'),
  ('新加坡', 'Singapore Botanic Gardens', '新加坡植物園'),
  ('新加坡', 'Singapore Botanic Gardens Gallop Extension', '新加坡植物園加洛普延伸區'),
  ('新加坡', 'Temasek Shophouse Garden', '淡馬錫店屋花園'),
  ('新加坡', 'The Lawn@Marina Bay', '濱海灣草坪'),
  ('新加坡', 'Youth Olympic Park', '青年奧林匹克公園'),
  ('澳門', 'Commander Ho Yin Park;Ho Yin Park', '何賢公園'),
  ('澳門', 'Dr. Carlos D''Assumpcao Park', '宋玉生公園'),
  ('澳門', 'Leisure Area of Edif. Wang Hoi & Wang Kin', '宏開宏建休憩區'),
  ('澳門', 'Lou Lim Ioc Park', '盧廉若公園'),
  ('澳門', 'Luis de Camoes Park', '白鴿巢公園'),
  ('澳門', 'Public park', '公園'),
  ('澳門', 'Taipa Central Park', '氹仔中央公園'),
  ('香港', 'King George V Memorial Park, Kowloon', '九龍佐治五世紀念公園'),
  ('香港', 'Kowloon Park', '九龍公園'),
  ('香港', 'New Hung Hom Harbourfront', '紅磡新海濱'),
  ('香港', 'Nursery Park', '苗圃公園'),
  ('香港', 'Public park', '公園'),
  ('香港', 'Tsim Sha Tsui Promenade', '尖沙咀海濱花園'),
  -- These Macau OSM labels already had Chinese followed by Portuguese.
  ('澳門', '區華利前地 Lazer de Praça de Jorge Álvares', '區華利前地'),
  ('澳門', '回歸公園 Jardim da Rua de Malaca', '回歸公園'),
  ('澳門', '大炮台公園 Parque da Fortaleza do Monte', '大炮台公園'),
  ('澳門', '海景花園休憩區 Zona de Lazer da Praceta de Miramar', '海景花園休憩區'),
  ('澳門', '綠楊花園休憩區 Zona de Lazer do Edf. Lok Yeong Fa Yuen', '綠楊花園休憩區'),
  ('澳門', '船廠街休憩區 Zona de Lazer da Rua dos Estaleiros', '船廠街休憩區'),
  ('澳門', '華士古達嘉馬花園 Jardim Vasco da Gama', '華士古達嘉馬花園'),
  ('澳門', '觀音像海濱休憩區 Zona de Lazer da Marginal da Estátua de Kun Iam', '觀音像海濱休憩區')
)
update public.sea_shores s
set name_zh = f.new_name
from fixes f
where s.game_enabled
  and s.city_zh = f.city_zh
  and s.name_zh = f.old_name;

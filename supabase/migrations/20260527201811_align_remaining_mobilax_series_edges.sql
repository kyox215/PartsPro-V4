-- Finish Mobilax-aligned phone series edge cases found in the full catalog:
-- Motorola Moto E/G models with no space before the generation number, OPPO
-- Reno models written as RENO2/RENO3, Samsung Galaxy Fold under Galaxy Z,
-- and Mobilax's full "Series One/C/Defy" Motorola label.

create or replace function private.partspro_model_series(_brand text, _model text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when nullif(btrim(coalesce(_brand, '')), '') is null
      or nullif(btrim(coalesce(_model, '')), '') is null
      or lower(btrim(_brand)) = 'apple'
      then null
    when lower(btrim(_brand)) = 'samsung' then
      case
        when btrim(_model) ~* '\mgalaxy\s+(z|fold)\M' then 'Galaxy Z'
        when btrim(_model) ~* '\mgalaxy\s+note\M' then 'Galaxy Note'
        when btrim(_model) ~* '\mgalaxy\s+xcover\M' then 'Galaxy XCover'
        when btrim(_model) ~* '\mgalaxy\s+s\s*\d' then 'Galaxy S'
        when btrim(_model) ~* '\mgalaxy\s+a\s*\d' then 'Galaxy A'
        when btrim(_model) ~* '\mgalaxy\s+m\s*\d' then 'Galaxy M'
        when btrim(_model) ~* '\mgalaxy\s+j\s*\d' then 'Galaxy J'
        else 'Galaxy Other'
      end
    when lower(btrim(_brand)) = 'xiaomi' then
      case
        when btrim(_model) ~* '^redmi\s+note\M' then 'Redmi Note'
        when btrim(_model) ~* '^redmi\M' then 'Redmi'
        when btrim(_model) ~* '^(poco|pocophone)\M'
          or btrim(_model) ~* '^black\s+shark\M' then 'Poco/Shark'
        when btrim(_model) ~* '^mi\s+(mix|max)\M' then 'Mi Mix / Max'
        when btrim(_model) ~* '^mi\M' then 'Mi'
        else 'Xiaomi'
      end
    when lower(btrim(_brand)) = 'honor' then
      case
        when btrim(_model) ~* '^(honor\s+)?(5|6|7|8|9)([[:alpha:]]|\M)' then 'Series 5/6/7/8/9'
        when btrim(_model) ~* '^(honor\s+)?(10|20|50)([[:alpha:]]|\M)' then 'Series 10/20/50'
        when btrim(_model) ~* '^(honor\s+)?(70|90|200|300|400|600)([[:alpha:]]|\M)' then 'Series 70/90/200/300/400'
        when btrim(_model) ~* '\m(magic|view)\M'
          or btrim(_model) ~* '^(honor\s+)?play$' then 'Series Magic / Play / View'
        when btrim(_model) ~* '\mplay\M' then 'Series Play'
        when btrim(_model) ~* '\mx\s*\d' then 'Series X'
        else 'Honor Other'
      end
    when lower(btrim(_brand)) = 'oppo' then
      case
        when btrim(_model) ~* '\mfind\M' then 'Find'
        when btrim(_model) ~* '\mreno(\M|\s*\d)' then 'Reno'
        when btrim(_model) ~* '\ma\s*\d' then 'A'
        when btrim(_model) ~* '\mf\s*\d' then 'F'
        when btrim(_model) ~* '\mrx\s*\d' then 'RX'
        else 'OPPO Other'
      end
    when lower(btrim(_brand)) = 'realme' then
      case
        when btrim(_model) ~* '^(realme\s+)?(5|6|7)([[:alpha:]]|\M)' then 'Series 5/6/7'
        when btrim(_model) ~* '^(realme\s+)?(8|9|10)([[:alpha:]]|\M)' then 'Series 8/9/10'
        when btrim(_model) ~* '^(realme\s+)?(11|12|14|16)([[:alpha:]]|\M)' then 'Series 11/12/14/16'
        when btrim(_model) ~* '\m(narzo|note)\M' then 'Series narzo / Note'
        when btrim(_model) ~* '\m(c\s*\d|gt(\s*\d|\M)|x\s*\d|p\s*\d)' then 'Series C/GT/X/P'
        else 'Realme Other'
      end
    when lower(btrim(_brand)) = 'motorola' then
      case
        when btrim(_model) ~* '\medge\M' then 'Edge'
        when btrim(_model) ~* '\mrazr\M' then 'Razr'
        when btrim(_model) ~* '\mmoto\s+g(\M|\d)'
          or btrim(_model) ~* '^g\s*\d' then 'Moto G'
        when btrim(_model) ~* '\mmoto\s+e(\M|\d)'
          or btrim(_model) ~* '^e\s*\d' then 'Moto E'
        when btrim(_model) ~* '\mmoto\s+[xz](\M|\d)'
          or btrim(_model) ~* '^[xz]\s*\d' then 'Moto X/Z'
        when btrim(_model) ~* '\mone\M'
          or btrim(_model) ~* '\mdefy\M'
          or btrim(_model) ~* '\mmoto\s+c(\M|\d)'
          or btrim(_model) ~* '^c\s*\d' then 'Series One/C/Defy'
        else 'Motorola Other'
      end
    when lower(btrim(_brand)) = 'vivo' then
      case
        when btrim(_model) ~* '\miqoo\M' then 'iQOO'
        when btrim(_model) ~* '\mv\s*\d' then 'Vivo V'
        when btrim(_model) ~* '\mx\s*\d' then 'Vivo X'
        when btrim(_model) ~* '\my\s*\d' then 'Vivo Y'
        when btrim(_model) ~* '\mt\s*\d' then 'Vivo T'
        when btrim(_model) ~* '\ms\s*\d' then 'Vivo S'
        else 'Vivo'
      end
    when lower(btrim(_brand)) = 'tcl' then
      case
        when btrim(_model) ~* '\mnxtpaper\M' then 'TCL NXTPAPER'
        else 'TCL'
      end
    else initcap(lower(btrim(_brand))) || ' Other'
  end
$$;

update public.products
set model_series = private.partspro_model_series(brand, model)
where lower(btrim(coalesce(brand, ''))) <> 'apple'
  and private.partspro_model_series(brand, model) is not null
  and model_series is distinct from private.partspro_model_series(brand, model);;

-- Pluggable cadastral-provider support (docs/roadmap-differentiation-
-- features.md > Feature 2 revision): matching a parcel to a real
-- government cadastral registry is stronger evidence in a succession
-- dispute than a hand-drawn pin — this adds the columns to record that
-- distinction and which country's provider was used.
--
-- source has three states, not two, because "automated match" and "visual
-- match against a real official layer, confirmed by the user" are
-- genuinely different evidentiary strength — collapsing them would
-- overstate what a visual confirmation actually proves. See the Kosovo
-- provider (src/lib/land/providers/kosovo.ts) for why 'official_cadastre'
-- (fully automated) isn't achievable yet: the Kosovo Cadastral Agency
-- Geoportal's public API renders map imagery but doesn't expose
-- programmatic parcel-at-coordinate lookup (confirmed by testing, not
-- assumed — GetFeatureInfo returns empty even for points known to be
-- inside the layer's own coverage, and raw WFS is blocked).

alter table land_parcels add column country_code text;
alter table land_parcels add column cadastral_reference text;
alter table land_parcels add column source text not null default 'manual_pin'
  check (source in ('official_cadastre', 'official_cadastre_visual', 'manual_pin'));

comment on column land_parcels.country_code is
  'ISO 3166-1 alpha-2, e.g. XK (Kosovo). Selected by the user at the start of the parcel flow — picks which CadastralProvider ran.';
comment on column land_parcels.cadastral_reference is
  'Official parcel ID from a government registry. Only ever set when source = official_cadastre (not yet achievable for any provider — see comment above).';
comment on column land_parcels.source is
  'official_cadastre: automated match to a government registry (no provider does this yet). official_cadastre_visual: user placed the pin against a real official boundary overlay and confirmed it visually. manual_pin: no official layer was available or checked.';

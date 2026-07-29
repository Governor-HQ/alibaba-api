-- Seat-map toggle for buses (#3)
-- Buses with seat_map_enabled = false are booked first-come-first-serve:
-- the customer doesn't pick a seat; the system auto-assigns the next free one.
ALTER TABLE buses ADD COLUMN IF NOT EXISTS seat_map_enabled BOOLEAN NOT NULL DEFAULT true;

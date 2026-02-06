-- Seed default clients and projects for In DO Time
-- B.B. (GA Gymnastics State Meets) and Mariah (Evermore Equine)

-- Insert B.B. client (blue color to distinguish from Mariah)
INSERT INTO clients (name, hourly_rate, color, status)
SELECT 'B.B.', 30.00, '#2563EB', 'active'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'B.B.');

-- Insert Mariah client (purple color)
INSERT INTO clients (name, hourly_rate, color, status)
SELECT 'Mariah', 45.00, '#7C3AED', 'active'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Mariah');

-- Insert GA Gymnastics State Meets project under B.B.
INSERT INTO projects (client_id, name, status)
SELECT c.id, 'GA Gymnastics State Meets', 'active'
FROM clients c
WHERE c.name = 'B.B.'
AND NOT EXISTS (
  SELECT 1 FROM projects p
  WHERE p.client_id = c.id AND p.name = 'GA Gymnastics State Meets'
);

-- Insert Evermore Equine project under Mariah
INSERT INTO projects (client_id, name, status)
SELECT c.id, 'Evermore Equine', 'active'
FROM clients c
WHERE c.name = 'Mariah'
AND NOT EXISTS (
  SELECT 1 FROM projects p
  WHERE p.client_id = c.id AND p.name = 'Evermore Equine'
);

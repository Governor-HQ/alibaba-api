-- Cars table
CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL,
  price_day NUMERIC(10,2) NOT NULL,
  description TEXT,
  features TEXT[],
  image_url TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  car_id INTEGER REFERENCES cars(id),
  customer_name VARCHAR(100) NOT NULL,
  customer_email VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Starter car data
INSERT INTO cars (name, model, year, category, price_day, description, features, image_url) VALUES
('Toyota Land Cruiser', 'LC300', 2023, 'suv', 45000, 'Premium SUV perfect for Nigerian roads and long-distance travel.', ARRAY['Air Conditioning', '4WD', 'GPS', 'Leather Seats'], 'https://images.unsplash.com/photo-1594534475808-b18ac615b0f5?w=800'),
('Mercedes-Benz', 'E-Class', 2022, 'luxury', 80000, 'Executive luxury sedan for VIP transport and corporate use.', ARRAY['Air Conditioning', 'Leather Seats', 'Sunroof', 'Bluetooth'], 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800'),
('Toyota Hiace', 'High Roof', 2021, 'van', 35000, 'Spacious van ideal for group transport and logistics.', ARRAY['Air Conditioning', 'Large Capacity', 'Sliding Door'], 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800'),
('Honda CR-V', 'Sport', 2022, 'suv', 38000, 'Compact SUV great for city driving and weekend trips.', ARRAY['Air Conditioning', 'Apple CarPlay', 'Lane Assist', 'Reverse Camera'], 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800'),
('Ford Transit Van', 'Transit Custom', 2021, 'van', 35000, 'Cargo and passenger van ideal for deliveries and equipment transport.', ARRAY['Air Conditioning', 'Bluetooth', 'Sliding Door', 'Large Boot'], 'https://images.unsplash.com/photo-1566787832182-ea52d3bd83d3?w=800'),
('Toyota Corolla', 'Corolla LE', 2023, 'sedan', 18000, 'Most popular sedan in Nigeria. Economical, reliable, easy to drive.', ARRAY['Air Conditioning', 'Bluetooth Audio', 'USB Charging', 'Fuel Efficient'], 'https://images.unsplash.com/photo-1623869675781-80aa31012a5a?w=800'),
('Lexus LX 570', 'LX 570 Sport', 2022, 'luxury', 120000, 'Ultimate luxury SUV for VIP events and executive transport.', ARRAY['Full Leather', 'Entertainment System', 'Climate Control', '4WD', 'GPS', 'Sunroof'], 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800'),
('Kia Sorento', 'Sorento EX', 2023, 'suv', 42000, 'Modern family SUV with advanced safety features and comfort.', ARRAY['Air Conditioning', 'Apple CarPlay', 'Android Auto', 'Blind Spot Monitor'], 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?w=800');

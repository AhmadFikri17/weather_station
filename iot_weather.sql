CREATE TABLE weather_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ts DATETIME NOT NULL,
    tmp DECIMAL(5,2),
    hum INT,
    wnd DECIMAL(5,2),
    knt DECIMAL(5,2),
    ang INT,
    dir VARCHAR(20),
    rn DECIMAL(6,2),
    lx INT
);

CREATE DATABASE IF NOT EXISTS ecommerce;

USE ecommerce;


CREATE TABLE users (

    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(150) UNIQUE NOT NULL,

    password VARCHAR(255) NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

);


CREATE TABLE products (

    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(150) NOT NULL,

    description TEXT,

    price DECIMAL(10,2) NOT NULL,

    stock INT DEFAULT 0,

    category VARCHAR(100),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_products_category(category),

    INDEX idx_products_name(name)

);


CREATE TABLE cart_items (

    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    product_id INT NOT NULL,

    quantity INT DEFAULT 1,

    UNIQUE KEY
        unique_cart_product
        (user_id, product_id),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE

);


CREATE TABLE orders (

    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    total_amount DECIMAL(10,2) NOT NULL,

    status VARCHAR(50)
        DEFAULT 'PENDING',

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)

);


CREATE TABLE order_items (

    id INT AUTO_INCREMENT PRIMARY KEY,

    order_id INT NOT NULL,

    product_id INT NOT NULL,

    quantity INT NOT NULL,

    price DECIMAL(10,2) NOT NULL,

    FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    FOREIGN KEY (product_id)
        REFERENCES products(id)

);


INSERT INTO products
(name, description, price, stock, category)
VALUES

(
    'iPhone 16',
    'Apple smartphone',
    79999,
    10,
    'Mobile'
),

(
    'Samsung Galaxy S25',
    'Samsung smartphone',
    74999,
    15,
    'Mobile'
),

(
    'Sony Headphones',
    'Wireless headphones',
    9999,
    20,
    'Audio'
);

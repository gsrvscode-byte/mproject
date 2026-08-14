
# E-Commerce MySQL Project

Node.js + Express + MySQL REST API.

## 1. Install dependencies

npm install


## 2. Create database

Open MySQL:

mysql -u root -p

Then execute:

SOURCE database/schema.sql;


## 3. Create .env

Copy:

.env.example

to:

.env


Example:

PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=ecommerce

JWT_SECRET=mysecretkey


## 4. Start server

npm run dev


Server:

http://localhost:5000


## APIs

AUTH

POST /api/auth/register

POST /api/auth/login


PRODUCTS

GET    /api/products

GET    /api/products/:id

POST   /api/products

PUT    /api/products/:id

DELETE /api/products/:id


CART

GET    /api/cart

POST   /api/cart

DELETE /api/cart/:productId


ORDERS

POST /api/orders

GET  /api/orders

GET  /api/orders/:id


## Authorization

After login:

Authorization: Bearer YOUR_TOKEN


## Example register

{
    "name": "Gopal",
    "email": "gopal@example.com",
    "password": "123456"
}


## Example login

{
    "email": "gopal@example.com",
    "password": "123456"
}


## Example product

{
    "name": "Laptop",
    "description": "Gaming laptop",
    "price": 75000,
    "stock": 10,
    "category": "Laptop"
}

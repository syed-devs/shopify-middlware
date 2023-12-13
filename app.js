const jwt = require("jsonwebtoken");
const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const Shopify = require("shopify-api-node");
var cors = require("cors");
const { default: axios } = require("axios");
const config = {
  headers: {
    "Content-Type": "application/json",
  },
};

// Load environment variables
dotenv.config();
const secretKey = process.env.SECRET;

// Set up Shopify API
const shopify = new Shopify({
  shopName: process.env.SHOP_NAME,
  apiKey: process.env.API_KEY,
  password: process.env.PASSWORD,
  apiVersion: "2023-10", // Update with the latest Shopify API version
});

const app = express();
app.use(cors());

// Use bodyParser to parse incoming JSON payloads
app.use(bodyParser.json());

app.post("/shopify-auth", async (req, res) => {
  const { email } = req.body;
  console.log("email =================", email);
  if (email) {
    const customerDetail = await shopify.customer.search({ email });
    console.log("customer data ================", customerDetail);

    if (customerDetail?.length > 0) {
      const payloadData = {
        userId: customerDetail[0].id,
      };
      const jwtOptions = {
        algorithm: "HS256", // HMAC SHA-256 algorithm
        expiresIn: "21h", // Token expiration time
      };
      const token = jwt.sign(payloadData, secretKey, jwtOptions);
      return res
        .status(200)
        .json({ message: "token created and saved successfully", token });
    } else {
      return res.status(204).json({ message: "user not found" });
    }
  } else {
    return res.status(400).json({ message: "email is required" });
  }
});

app.post("/shopify-create-event", async (req, res) => {
  const { token, event } = req.body;
  console.log("body============", req.body);
  if (token && event && event.hasOwnProperty("event_name")) {
    try {
      // Verify the JWT
      const decoded = await jwt.verify(token, secretKey);
      if (decoded?.hasOwnProperty("userId")) {
        const shopify_user = await shopify.customer.get(decoded.userId);
        console.log("shopify user==============", shopify_user);
        console.log(
          "process.env.DOMAIN===========================",
          process.env.DOMAIN
        );
        if (shopify_user) {
          try {
            const { data } = await axios.post(
              `${process.env.DOMAIN}/create-event`,
              {
                username: shopify_user.email, // email
                event_name: event.event_name,
                event_date: event.event_date,
                attendees: event.attendees,
              },
              config
            );
            console.log("aws res ====", data);
            return res.status(200).json({ message: "event created successfully", data });
          } catch (error) {
            console.log("create event res error ==========", error);
            return res
              .status(401)
              .json({ message: "server error while creating event" });
          }
        } else {
          return res.status(401).json({ message: "shopfiy user not found" });
        }
      } else {
        return res.status(401).json({ message: "token expired" });
      }
    } catch (error) {
      console.log("toke catch error=====", error);
      return res.status(401).json({ message: "token is not valid" });
    }
  } else {
    return res.status(400).json({ message: "token or event missing" });
  }
});

app.get("/shopify-get-events", async (req, res) => {
  const { token } = req.body;
  console.log("token=========",token)
  if (token) {
    try {
      // Verify the JWT
      const decoded = await jwt.verify(token, secretKey);
      console.log("doceded=================",decoded);
      if (decoded.hasOwnProperty("userId")) {
        const shopify_user = await shopify.customer.get(decoded.userId);
        console.log("shopify user==================",shopify_user);
        if (shopify_user) {
          console.log("user secret",process.env.CLIENT_SECRET,"username",shopify_user.email)
          try {
            const { data } = await axios.post(
              `${process.env.DOMAIN}/get-events`,
              {
                user_secret:"TJKH^6497GuT7Hu^&ubKJh8&%8^rhuy4&YMG",
                username: shopify_user.email, 
              },
              config
            );
            return res.status(200).json({ message: "success", data });
          } catch (error) {
            console.log("get events res error========", error);
            return res
              .status(500)
              .json({ message: "server error while geting events" });
          }
        }
      } else {
        return res.status(401).json({ message: "token expired" });
      }
    } catch (error) {
      return res.status(401).json({ message: "JWT is not valid" });
    }
  } else {
    return res.status(400).json({ message: "token missing" });
  }
});

app.get("/", (req, res) => {
  res.send("hello");
});

// Your Shopify App Proxy path
const proxyPath = '/apps/express-proxy';

app.get(proxyPath, async (req, res) => {
  try {
    // Extract shop domain and access token from request
    const shop = req.query.shop;
    console.log("shopify shop==================",shop);
    const accessToken = req.query.access_token;
    console.log("shopify accessToken==================",accessToken);

    // Make API call to fetch customer data
    const customerResponse = await axios.get(`https://${shop}/admin/api/2021-10/customers.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });

    const customers = customerResponse.data.customers;
    console.log("shopify customers==================",customers);
    res.json(customers);
  } catch (error) {
    console.error(error);
  }
});



app.post("/webhooks/customer/create", async (req, res) => {
  const customerData = req.body;
  console.log("customerData===========================",typeof customerData.id,"id",customerData.id, "id type",typeof customerData.id.toString());
  console.log("payload====================",{
    first_name: customerData.first_name,
    last_name: customerData.last_name,
    email: customerData.email,
    shopify_id: customerData.id.toString(),
  })
if(customerData)  {
  try {
      const { data } = await axios.post(`${process.env.DOMAIN}/create-user`, {
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        email: customerData.email,
        shopify_id: customerData.id.toString(),
      },config);
      res.status(200).json({message:"user created successfully",data});
    } catch (error) {
      console.log("create user res error ====", error);
      res.status(500).json({message:"server error"});
    }
  } else {
    console.error("Error processing webhook:");
    res.status(500).send({message:"Internal Server Error"});
  }
});

const port = process.env.PORT || 8800;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Endpoint to handle customer create webhook

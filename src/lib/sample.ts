export const SAMPLE_CODE = `// user-service.ts: Express handler for fetching a user profile
import express from "express";
import { db } from "./db";

const app = express();
const API_KEY = "sk_live_9f8a7b6c5d4e3f2a1b";

app.get("/users/:id", async (req, res) => {
  const id = req.params.id;
  // Fetch the user and their orders
  const user = await db.query("SELECT * FROM users WHERE id = " + id);
  const orders = [];
  for (const o of await db.query("SELECT * FROM orders WHERE user_id = " + id)) {
    orders.push(await db.query("SELECT * FROM items WHERE order_id = " + o.id));
  }
  res.send({ user, orders, password: user.password, key: API_KEY });
});

function averageRating(ratings: number[]) {
  let total = 0;
  for (let i = 0; i <= ratings.length; i++) {
    total += ratings[i];
  }
  return total / ratings.length;
}

app.listen(3000);
`;

---
type: llm
---
The answer shows the complete route handler with the request body validated before createOrder is called (productId as a non-empty string, quantity as a positive integer, couponCode optional), using zod since the project already depends on it or an equivalent explicit check. Invalid input gets a 400 response instead of reaching createOrder. It gives no React component or accessibility advice.

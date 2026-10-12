# src/ conventions

- JSON response timestamps are ISO 8601 strings (`new Date().toISOString()`), never epoch numbers.
- `/api/time` may return epoch numbers.

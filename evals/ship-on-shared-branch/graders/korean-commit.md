---
type: regex
pattern: "\"command\":\"(?:[^\"\\\\]|\\\\.)*git commit(?:[^\"\\\\]|\\\\.)*[가-힣]"
match: contains
target: trace
---
The commit message follows the repository's language (recent commits are in Korean).

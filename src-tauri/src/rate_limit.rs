use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// A simple rate limiter that tracks requests per key within a time window.
pub struct RateLimiter {
    requests: Mutex<HashMap<String, Vec<Instant>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            requests: Mutex::new(HashMap::new()),
            max_requests,
            window: Duration::from_secs(window_secs),
        }
    }

    pub fn check(&self, key: &str) -> Result<(), String> {
        let mut requests = self
            .requests
            .lock()
            .map_err(|e| format!("Rate limiter lock failed: {}", e))?;

        let now = Instant::now();
        let entry = requests.entry(key.to_string()).or_insert_with(Vec::new);

        // Remove old requests outside the window (self-cleaning)
        entry.retain(|&t| now.duration_since(t) < self.window);

        if entry.len() >= self.max_requests {
            return Err(format!(
                "Rate limit exceeded: max {} requests per {} seconds",
                self.max_requests,
                self.window.as_secs()
            ));
        }

        entry.push(now);
        Ok(())
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new(10, 60) // 10 requests per minute
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limiter_allows_within_limit() {
        let limiter = RateLimiter::new(3, 60);

        assert!(limiter.check("test").is_ok());
        assert!(limiter.check("test").is_ok());
        assert!(limiter.check("test").is_ok());
    }

    #[test]
    fn test_rate_limiter_blocks_over_limit() {
        let limiter = RateLimiter::new(3, 60);

        assert!(limiter.check("test").is_ok());
        assert!(limiter.check("test").is_ok());
        assert!(limiter.check("test").is_ok());
        assert!(limiter.check("test").is_err());
    }

    #[test]
    fn test_rate_limiter_separate_keys() {
        let limiter = RateLimiter::new(2, 60);

        assert!(limiter.check("key1").is_ok());
        assert!(limiter.check("key1").is_ok());
        assert!(limiter.check("key1").is_err());

        // Different key should still work
        assert!(limiter.check("key2").is_ok());
        assert!(limiter.check("key2").is_ok());
    }
}

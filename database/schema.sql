-- DigitalDetox Database Schema

CREATE DATABASE IF NOT EXISTS DigitalDetox;
USE DigitalDetox;

-- 2. LEVEL Table
CREATE TABLE LEVEL (
    level_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    min_points INT NOT NULL,
    max_points INT NOT NULL,
    coupon_discount_pct DECIMAL(5, 2) DEFAULT 0.00,
    shields_granted INT DEFAULT 0,
    badge_icon VARCHAR(255)
);

-- 1. USER Table
CREATE TABLE USER (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    level_id INT,
    total_points INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    shields_available INT DEFAULT 0,
    FOREIGN KEY (level_id) REFERENCES LEVEL(level_id)
);

-- 3. APP_LIMIT Table
CREATE TABLE APP_LIMIT (
    limit_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    app_name VARCHAR(100) NOT NULL,
    platform VARCHAR(50),
    daily_limit_min INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES USER(user_id)
);

-- 4. SCREEN_LOG Table
CREATE TABLE SCREEN_LOG (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    limit_id INT NOT NULL,
    log_date DATE NOT NULL,
    actual_usage_min INT NOT NULL,
    limit_breached BOOLEAN NOT NULL,
    points_earned INT DEFAULT 0,
    shield_used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES USER(user_id),
    FOREIGN KEY (limit_id) REFERENCES APP_LIMIT(limit_id)
);

-- 5. STREAK Table
CREATE TABLE STREAK (
    streak_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    start_date DATE NOT NULL,
    current_count INT DEFAULT 0,
    longest_count INT DEFAULT 0,
    last_active_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES USER(user_id)
);

-- 6. CHALLENGE Table
CREATE TABLE CHALLENGE (
    challenge_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    type ENUM('SOLO', 'GROUP') DEFAULT 'SOLO',
    target_days INT NOT NULL,
    target_limit_min INT NOT NULL,
    bonus_points INT DEFAULT 0,
    start_date DATE,
    end_date DATE
);

-- 7. USER_CHALLENGE Table
CREATE TABLE USER_CHALLENGE (
    uc_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    challenge_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    days_completed INT DEFAULT 0,
    status ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED') DEFAULT 'IN_PROGRESS',
    bonus_awarded BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES USER(user_id),
    FOREIGN KEY (challenge_id) REFERENCES CHALLENGE(challenge_id)
);

-- 8. GROUP_CHALLENGE Table
CREATE TABLE GROUP_CHALLENGE (
    gc_id INT AUTO_INCREMENT PRIMARY KEY,
    challenge_id INT NOT NULL,
    created_by INT NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    target_members INT DEFAULT 2,
    all_passed BOOLEAN DEFAULT FALSE,
    group_bonus_points INT DEFAULT 0,
    FOREIGN KEY (challenge_id) REFERENCES CHALLENGE(challenge_id),
    FOREIGN KEY (created_by) REFERENCES USER(user_id)
);

-- 9. COUPON Table
CREATE TABLE COUPON (
    coupon_id INT AUTO_INCREMENT PRIMARY KEY,
    brand_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    discount_value VARCHAR(50) NOT NULL,
    points_required INT NOT NULL,
    min_level_id INT,
    expiry_date DATE,
    total_stock INT DEFAULT 0,
    redeemed_count INT DEFAULT 0,
    FOREIGN KEY (min_level_id) REFERENCES LEVEL(level_id)
);

-- 10. USER_COUPON Table
CREATE TABLE USER_COUPON (
    uc_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    coupon_id INT NOT NULL,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    redemption_code VARCHAR(100) UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES USER(user_id),
    FOREIGN KEY (coupon_id) REFERENCES COUPON(coupon_id)
);

-- Initial Data for LEVELS
INSERT INTO LEVEL (name, min_points, max_points, coupon_discount_pct, shields_granted) VALUES
('Bronze', 0, 40, 0.00, 0),
('Silver', 41, 70, 5.00, 1),
('Gold', 71, 100, 10.00, 2),
('Platinum', 101, 999999, 20.00, 3);

-- Initial Data for CHALLENGES
INSERT INTO CHALLENGE (title, description, type, target_days, target_limit_min, bonus_points) VALUES
('Weekend Warrior', 'Stay under 2 hours of screen time for the whole weekend!', 'SOLO', 2, 120, 50),
('Social Media Detox', 'Limit all social media apps to 30 mins a day for a week.', 'SOLO', 7, 30, 200),
('Study Focus', 'No games or entertainment apps during study hours.', 'SOLO', 5, 0, 150),
('Early Bird', 'No screen time before 8 AM for 3 days.', 'SOLO', 3, 0, 100);

-- 11. FRIENDSHIP Table
CREATE TABLE IF NOT EXISTS FRIENDSHIP (
    friendship_id INT AUTO_INCREMENT PRIMARY KEY,
    requester_id  INT NOT NULL,
    addressee_id  INT NOT NULL,
    status        ENUM('PENDING', 'ACCEPTED', 'DECLINED') DEFAULT 'PENDING',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_friendship (requester_id, addressee_id),
    FOREIGN KEY (requester_id) REFERENCES USER(user_id),
    FOREIGN KEY (addressee_id) REFERENCES USER(user_id)
);



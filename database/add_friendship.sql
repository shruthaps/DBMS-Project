

USE DigitalDetox;

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

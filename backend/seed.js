const db = require('./db');

async function seedDatabase() {
  try {
    console.log('Checking database tables to seed...');

    // Migration: Ensure LEVEL has badge_icon column
    try {
      await db.query('ALTER TABLE LEVEL ADD COLUMN badge_icon VARCHAR(255) DEFAULT NULL');
      console.log('Successfully added badge_icon column to LEVEL table!');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {
        console.error('Error adding badge_icon column:', e);
      }
    }

    // Migration: Ensure LEVEL has shields_granted column
    try {
      await db.query('ALTER TABLE LEVEL ADD COLUMN shields_granted INT DEFAULT 0');
      console.log('Successfully added shields_granted column to LEVEL table!');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {
        console.error('Error adding shields_granted column:', e);
      }
    }

    // 1. Seed Solo Challenges if empty
    const [challenges] = await db.query('SELECT COUNT(*) as count FROM CHALLENGE');
    if (challenges[0].count === 0) {
      console.log('CHALLENGE table is empty. Seeding initial solo challenges...');
      const initialChallenges = [
        [
          'Weekend Warrior',
          'Stay under 2 hours of screen time for the whole weekend!',
          'SOLO',
          2,
          120,
          50
        ],
        [
          'Social Media Detox',
          'Limit all social media apps to 30 mins a day for a week.',
          'SOLO',
          7,
          30,
          200
        ],
        [
          'Study Focus',
          'No games or entertainment apps during study hours.',
          'SOLO',
          5,
          0,
          150
        ],
        [
          'Early Bird',
          'No screen time before 8 AM for 3 days.',
          'SOLO',
          3,
          0,
          100
        ],
        [
          'Unplugged Evening',
          'No screen time at all after 8 PM for 4 consecutive days.',
          'SOLO',
          4,
          0,
          120
        ],
        [
          'Productivity Sprint',
          'Limit productive and educational apps to a healthy 90 mins max daily for 5 days.',
          'SOLO',
          5,
          90,
          80
        ]
      ];

      for (const [title, desc, type, days, limit, points] of initialChallenges) {
        await db.query(
          `INSERT INTO CHALLENGE (title, description, type, target_days, target_limit_min, bonus_points)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [title, desc, type, days, limit, points]
        );
      }
      console.log('Database successfully seeded with standard Solo Challenges!');
    } else {
      console.log(`CHALLENGE table already contains ${challenges[0].count} challenges.`);
    }

    // 2. Ensure LEVEL values are exactly as requested
    const [levels] = await db.query('SELECT COUNT(*) as count FROM LEVEL');
    if (levels[0].count === 0) {
      console.log('LEVEL table is empty. Seeding initial levels...');
      const initialLevels = [
        ['Bronze', 0, 40, 0.00, 0, '🥉'],
        ['Silver', 41, 70, 10.00, 1, '🥈'],
        ['Gold', 71, 100, 20.00, 2, '🥇'],
        ['Platinum', 101, 999999, 30.00, 3, '👑']
      ];
      for (const [name, min, max, discount, shields, badge] of initialLevels) {
        await db.query(
          `INSERT INTO LEVEL (name, min_points, max_points, coupon_discount_pct, shields_granted, badge_icon)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [name, min, max, discount, shields, badge]
        );
      }
      console.log('LEVEL table successfully seeded!');
    } else {
      console.log('Ensuring LEVEL point limits are up to date...');
      await db.query('UPDATE LEVEL SET min_points = 0, max_points = 40 WHERE name = "Bronze"');
      await db.query('UPDATE LEVEL SET min_points = 41, max_points = 70 WHERE name = "Silver"');
      await db.query('UPDATE LEVEL SET min_points = 71, max_points = 100 WHERE name = "Gold"');
      await db.query('UPDATE LEVEL SET min_points = 101, max_points = 999999 WHERE name = "Platinum"');
      console.log('LEVEL point limits verified!');
    }

  } catch (error) {
    console.error('Error during database auto-seeding:', error);
  }
}

module.exports = seedDatabase;

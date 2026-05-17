const db = require('./db');

async function seedDatabase() {
  try {
    console.log('Checking database tables to seed...');

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
    if (levels[0].count > 0) {
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { NPlusOneDetector } from '../utils/nPlusOneDetector.js';

test('NPlusOneDetector: should detect simple JS for loop with prisma query', () => {
  const code = `
    async function getUsersAndPosts() {
      const users = await prisma.user.findMany();
      for (const user of users) {
        const posts = await prisma.post.findMany({ where: { authorId: user.id } });
        user.posts = posts;
      }
      return users;
    }
  `;
  assert.equal(NPlusOneDetector.detect(code), true);
});

test('NPlusOneDetector: should detect JS map loop with mongoose query', () => {
  const code = `
    const enriched = await Promise.all(items.map(async (item) => {
      const details = await ItemDetails.findOne({ itemId: item._id });
      return { ...item, details };
    }));
  `;
  assert.equal(NPlusOneDetector.detect(code), true);
});

test('NPlusOneDetector: should detect Python for loop with SQLAlchemy query', () => {
  const code = `
    def get_data(session):
        users = session.query(User).all()
        for user in users:
            profile = session.query(Profile).filter_by(user_id=user.id).first()
            user.profile = profile
        return users
  `;
  assert.equal(NPlusOneDetector.detect(code), true);
});

test('NPlusOneDetector: should NOT detect queries outside loops', () => {
  const code = `
    async function getData() {
      const items = await prisma.item.findMany();
      // some loop
      for (let i = 0; i < 10; i++) {
        console.log(i);
      }
      const details = await prisma.details.findMany();
      return { items, details };
    }
  `;
  assert.equal(NPlusOneDetector.detect(code), false);
});

test('NPlusOneDetector: should handle empty code', () => {
  assert.equal(NPlusOneDetector.detect(''), false);
  assert.equal(NPlusOneDetector.detect(null), false);
});

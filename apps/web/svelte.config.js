import adapter from '@sveltejs/adapter-static';

const configuredBase = process.env.SAVE_SLOT_BASE_PATH?.trim() ?? '';
if (configuredBase && (!configuredBase.startsWith('/') || configuredBase.endsWith('/'))) {
  throw new Error('SAVE_SLOT_BASE_PATH must start with / and must not end with /.');
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      fallback: 'index.html',
      precompress: true,
      strict: false,
    }),
    paths: {
      base: configuredBase,
      relative: true,
    },
  },
};

export default config;

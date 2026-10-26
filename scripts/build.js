delete process.env.TURBOPACK;
process.argv = [process.argv[0], process.argv[1], 'build'];
require('next/dist/bin/next');

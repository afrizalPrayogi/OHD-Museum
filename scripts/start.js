delete process.env.TURBOPACK;
process.argv = [process.argv[0], process.argv[1], 'start', '-p', process.env.PORT || '3001'];
require('next/dist/bin/next');

var connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432';
var dbName = 'navi';

var dbConnectionString = `${connectionString}/${dbName}`;
export { dbConnectionString };
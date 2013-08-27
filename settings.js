//Settings.js is not part of the repository.  However, it should be deployed with the application and contain deployment-specific settings.
//there is a settings.js.example file that should match the structure and properties of this file that IS checked in to the repo.
var settings = {}

settings.pg = {};
settings.application = {};

//application port settings
settings.application.port = 3000;
settings.application.ip = "localhost";

//Settings for postgres DB
settings.pg.username = 'postgres';
settings.pg.password = 'postgres';
settings.pg.server = 'ec2-54-227-245-32.compute-1.amazonaws.com';
settings.pg.port = '5432';
settings.pg.database = 'test';

module.exports = settings;
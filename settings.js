//Settings.js is not part of the repository.  However, it should be deployed with the application and contain deployment-specific settings.
//there is a settings.js.example file that should match the structure and properties of this file that IS checked in to the repo.
var settings = {}

settings.pg = {};
settings.application = {};

//application port settings
settings.application.port = 3000;
settings.application.ip = "localhost";

//Settings for postgres DB
settings.pg.username = 'boundaryreader';
settings.pg.password = 'RedCrossReader!';
settings.pg.server = '54.213.93.178';
settings.pg.port = '5432';
settings.pg.database = 'Staging';

//Should the API display postgres views?
settings.displayViews = true;

//Should the API display postgres tables?
settings.displayTables = true;

//Should the API hide any postgres tables or views?
settings.pg.noFlyList = ["att_0"];

module.exports = settings;
const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server is started at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Jwt Token");
  } else {
    console.log(jwtToken);
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid Jwt Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const isUserThere = `
  select * from user 
  where username = '${username}';`;

  const checkUser = await db.get(isUserThere);
  if (checkUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(
      password,
      checkUser.password
    );
    if (isPasswordCorrect === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };

      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      console.log(jwtToken);
    }
  }
});

const convertItems = (eachItem) => {
  return {
    stateId: eachItem.state_id,
    stateName: eachItem.state_name,
    population: eachItem.population,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `select * from state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray.map((eachItem) => convertItems(eachItem)));
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `select * from state where state_id = ${stateId};`;

  const statesArray = await db.get(getStatesQuery);
  response.send(convertItems(statesArray));
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
insert into district (district_name , state_id , cases , cured , active , deaths)
values ('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}')
;`;

  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

const districtConvert = (eachItem) => {
  return {
    districtId: eachItem.district_id,
    districtName: eachItem.district_name,
    stateId: eachItem.state_id,
    cases: eachItem.cases,
    cured: eachItem.cured,
    active: eachItem.active,
    deaths: eachItem.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictWithId = `
    select * from district 
    where district_id = ${districtId};`;
    const districtDetails = await db.get(getDistrictWithId);
    response.send(districtConvert(districtDetails));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictId = `delete from district where district_id = ${districtId};`;
    await db.run(deleteDistrictId);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
update district set  
district_name = '${districtName}' , 
state_id = '${stateId}' ,
 cases = '${cases}',
  cured ='${cured}', 
  active ='${active}',
   deaths = '${deaths}'
where district_id = ${districtId}
   ;`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

const convertResults = (eachItem) => {
  return {
    totalCases: eachItem.totalCases,
    totalCured: eachItem.totalCured,
    totalActive: eachItem.totalActive,
    totalDeaths: eachItem.totalDeaths,
  };
};

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateResults = `select 
    sum(cases) as totalCases ,
     sum(cured) as totalCured,
      sum(active) as totalActive ,
       sum(deaths) as totalDeaths
     from district 
     where state_id = ${stateId};`;
    const stateResults = await db.get(getStateResults);
    response.send(convertResults(stateResults));
  }
);

module.exports = app;

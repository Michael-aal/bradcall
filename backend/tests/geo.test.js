import test from "node:test";import assert from "node:assert/strict";import {distanceKm,roundServiceAreaCoordinate,validCoordinates} from "../src/lib/geo.js";
test("validates coordinates",()=>{assert.equal(validCoordinates(6.5244,3.3792),true);assert.equal(validCoordinates(91,0),false);assert.equal(validCoordinates("bad",0),false)});
test("distance and privacy rounding",()=>{assert.equal(distanceKm(6.5,3.3,6.5,3.3),0);assert.ok(distanceKm(6.5,3.3,6.5,3.4)>10);assert.equal(roundServiceAreaCoordinate(6.524432),6.524)});

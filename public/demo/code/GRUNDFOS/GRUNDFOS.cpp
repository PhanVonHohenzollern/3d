#include "StdAfx.h"
#include "GRUNDFOS.h"


#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

const int cpx = 5;
const int concpx = 5;
#define SEGNUM(X) 16
#define RCFlange 45
#define FIX_BRX  // Break apart any closed boxes into two open
// pieces, resolving HLR problems in BricsCAD.

#if _MSC_VER < 1800
long round(double a)
{
	long result;
	double fa = floor(a);
	if (a - fa >= 0.5)
		result = (long)fa + 1;
	else
		result = (long)fa;
	return result;
};
#endif



FLM3Geo::ErrorStatus MakeFCBlock3d(FLM3Geo::BlockCreator3d* blockCreator, const char* blockName)
{
	ASSERT(blockCreator);

	GRUNDFOSBlockCreator oBlkCreator(*blockCreator);

	for (int Code = __COUNT_FN - 1; Code >= 0; --Code)
		if (!strcmp(blockName, __GEO_NAME[Code]))
			return (oBlkCreator.*__GEO_FN[Code])() ? FLM3Geo::eInvalid : FLM3Geo::eOK;
	return FLM3Geo::eInvalid;
};

short GRUNDFOSBlockCreator::makemagnaMAGNA3()
{
	char* check;
	get_val("conn_type", check);
	if (strcmp(check, "DIN") == 0) {
		makeMAGNA3_FLAGNED();
		
	}
	else {
		
		makeMAGNA3();
	}
	return 0;
}

short GRUNDFOSBlockCreator::makeMIXIT()
{
	FdVector3d vUp(vz), vN(vx);
	FdVector3d vCr = vUp.crossProduct(vN);
	FdPoint3d p0;

	double D, L1, L2, L3, B1, B2, H1, H2, H3, H4, D1, D2, D3, D4, D5, D6, D7;
	get_val("D", D);
	get_val("L1", L1);
	get_val("L2", L2);
	get_val("L3", L3);
	get_val("B1", B1);
	get_val("B2", B2);
	get_val("H1", H1);
	get_val("H2", H2);
	get_val("H3", H3);
	get_val("H4", H4);
	get_val("D1", D1);
	get_val("D2", D2);
	get_val("D3", D3);
	get_val("D4", D4);
	get_val("D5", D5);
	get_val("D6", D6);
	get_val("D7", D7);

	//make Body - S
	double radius = 5;
	FdPoint3d fullPoint[2] = { p0 - vN * H4, p0 + vN * H2 * 0.535};
	double tabHeight[2] = { B1, B1 };
	double tabWidth[2] = { 0.8 * L1, 0.8 * L1 };	
	bool sides[4] = { true, true, true, true };
	setMeshColor(47, 47, 47);
	makeRoundedBox(fullPoint[0], fullPoint[1], vN, vUp, tabHeight, tabWidth, radius, sides);

	fullPoint[0] = fullPoint[1];
	fullPoint[1] += vN * H2 * 0.065;
	FdVector3d normalVector[2] = { vN, vN };
	FdVector3d upVector[2] = { vUp, vUp };

	tabHeight[0] *= 0.85;
	tabHeight[1] *= 0.75;
	makeBox(1, fullPoint, normalVector, upVector, tabHeight, tabWidth, sides, true, true, 0, 0, 0);
	tabHeight[0] /= 0.85;
	tabHeight[1] /= 0.75;
	
	tabWidth[0] *= 0.85;
	tabWidth[1] *= 0.75;
	makeBox(1, fullPoint, normalVector, upVector, tabHeight, tabWidth, sides, true, true, 0, 0, 0);
	tabWidth[0] /= 0.85;
	tabWidth[1] /= 0.75;

	setMeshColor(255, 0, 0);
	fullPoint[1] += vN * H2 * 0.17;
	tabHeight[0] = B1 - 4;
	tabHeight[1] = B1;
	tabWidth[0] = 0.8 * L1 - 4;
	tabWidth[1] = 0.8 * L1;
	makeRoundedBox(fullPoint[0], fullPoint[1], vN, vUp, tabHeight, tabWidth, radius, sides);
	tabHeight[0] = B1;
	tabWidth[0] = 0.8 * L1;

	setMeshColor(47, 47, 47);
	fullPoint[0] = fullPoint[1];
	fullPoint[1] += vN * H2 * 0.23;
	makeRoundedBox(fullPoint[1], fullPoint[0], vN, vUp, tabHeight, tabWidth, radius, sides);
	//make Body - E

	//make Regulator - S
	setMeshColor(255, 255, 255);
	fullPoint[1] += vUp * 0.16 * tabWidth[0];
	fullPoint[0] = fullPoint[1];
	fullPoint[1] += vN * 0.1;
	double tabHeight1[2] = { 0.53 * tabHeight[0], 0.53 * tabHeight[0] };
	double tabWidth1[2] = { 0.45 * tabWidth[0], 0.45 * tabWidth[0] };
	makeBox(1, fullPoint, normalVector, upVector, tabWidth1, tabHeight1, sides, false, false, 0, 0, 0.005 * B1);

	double saveHeight = tabHeight1[0], saveWidth = tabWidth1[0];
	fullPoint[0] += vUp * 0.15 * saveHeight;
	fullPoint[1] += vUp * 0.15 * saveHeight;
	tabHeight1[0] = tabHeight1[1] = 0.25 * saveHeight;
	tabWidth1[0] = tabWidth1[1] = 0.3 * saveWidth;
	makeBox(1, fullPoint, normalVector, upVector, tabWidth1, tabHeight1, sides, true, true, 0, 0, 0);

	FdPoint3d cenPoint = fullPoint[0];
	fullPoint[0] += vCr * 0.3 * saveWidth;
	fullPoint[1] += vCr * 0.3 * saveWidth;
	for(int i = 0; i < 2; i++)
	{
		fullPoint[0].rotateBy(ARX_PI, vN, cenPoint);
		fullPoint[1].rotateBy(ARX_PI, vN, cenPoint);
		makeFlatDisc(fullPoint[0], vN, 0.045 * B1, cpx);
		makeVerySimpleTube(fullPoint, 0.045 * B1, cpx);
		makeFlatDisc(fullPoint[1], vN, 0.045 * B1, cpx);
	}

	fullPoint[0] += vUp * 0.2 * saveHeight - vCr * 0.3 * saveWidth;
	fullPoint[1] += vUp * 0.2 * saveHeight - vCr * 0.3 * saveWidth;
	for (int i = 0; i < 2; i++)
	{
		fullPoint[0].rotateBy(ARX_PI, vN, cenPoint);
		fullPoint[1].rotateBy(ARX_PI, vN, cenPoint);
		makeFlatDisc(fullPoint[0], vN, 0.045 * B1, cpx);
		makeVerySimpleTube(fullPoint, 0.045 * B1, cpx);
		makeFlatDisc(fullPoint[1], vN, 0.045 * B1, cpx);
	}

	fullPoint[0] -= vUp * 0.55 * saveHeight;
	fullPoint[1] -= vUp * 0.55 * saveHeight;
	tabHeight1[0] = tabHeight1[1] = 0.07 * saveHeight;
	tabWidth1[0] = tabWidth1[1] = 0.5 * saveWidth;
	makeBox(1, fullPoint, normalVector, upVector, tabWidth1, tabHeight1, sides, true, true, 0, 0, 0);

	fullPoint[0] -= vUp * 0.15 * saveHeight;
	fullPoint[1] -= vUp * 0.15 * saveHeight;
	tabHeight1[0] = tabHeight1[1] = 0.1 * saveHeight;
	tabWidth1[0] = tabWidth1[1] = 0.3 * saveWidth;
	makeBox(1, fullPoint, normalVector, upVector, tabWidth1, tabHeight1, sides, true, true, 0, 0, 0);
	//make Regulator - E

	//make Screws - S
	setMeshColor(255, 0, 0);
	fullPoint[0] = p0 + vN * 0.7 * H2 - vCr * B1 * 0.3334 - vUp * 0.4 * L1;
	fullPoint[1] = fullPoint[0] - vUp * 0.005 * L1;
	for (int i = 0; i < 3; i++) {
		makeVerySimpleTube(fullPoint, 0.1165 * B1, 2 * cpx);
		makeFlatDisc(fullPoint[1], vUp, 0.1165 * B1, 2 * cpx);
		fullPoint[0] += vCr * 0.2165 * B1;
		fullPoint[1] += vCr * 0.2165 * B1;
	}

	setMeshColor(47, 47, 47);
	fullPoint[0] = p0 + vN * 0.7 * H2 - vCr * B1 * 0.3334 - vUp * 0.405 * L1;
	fullPoint[1] = fullPoint[0] - vUp * 0.005 * L1;
	for (int i = 0; i < 3; i++) {
		makeVerySimpleTube(fullPoint, 0.1165 * B1, 2 * cpx);
		makeFlatDisc(fullPoint[1], vUp, 0.1165 * B1, 2 * cpx);
		fullPoint[0] += vCr * 0.2165 * B1;
		fullPoint[1] += vCr * 0.2165 * B1;
	}

	setMeshColor(255, 0, 0);
	fullPoint[0] += vUp * 0.005 * L1;
	makeVerySimpleTube(fullPoint, 0.1165 * B1, 2 * cpx);
	makeFlatDisc(fullPoint[1], vUp, 0.1165 * B1, 2 * cpx);

	setMeshColor(47, 47, 47);
	double deltaL = L3 - 0.8 * L1;
	fullPoint[1] = fullPoint[0] - vUp * deltaL * 0.9;
	fullPoint[0] -= vUp * 0.01 * L1;
	makeVerySimpleTube(fullPoint, 0.1165 * B1, 2 * cpx);

	makeDonutSection(fullPoint[1], vUp, vN, 0.05825 * B1 - 0.1 * deltaL, 0.2 * deltaL, 360, cpx, 2 * cpx);
	fullPoint[1] -= vUp * deltaL * 0.1;
	makeFlatDisc(fullPoint[1], vUp, 0.1165 * B1 - 0.2 * deltaL, 2 * cpx);

	fullPoint[0] -= vUp * 0.05 * deltaL;
	makeScrew(fullPoint[0], -vUp, vN, 0.15 * B1, 0.15 * deltaL, true, true);

	fullPoint[0] -= vUp * 0.4 * deltaL;
	makeScrew(fullPoint[0], -vUp, vN, 0.15 * B1, 0.35 * deltaL, true, true);
	//make Screws - E

	char* conn_type;
	get_val("ConnType", conn_type);
	if(	strcmp(conn_type, "Threaded") == 0){
		fullPoint[0] = p0 + vUp * L1 * 0.4;
		fullPoint[1] = p0 + vUp * L1 * 0.41;
		for (int i = 0; i < 2; i++) {
			fullPoint[0].rotateBy(ARX_PI, vN, p0);
			fullPoint[1].rotateBy(ARX_PI, vN, p0);
			makeVerySimpleTube(fullPoint, 0.8 * D, cpx);
		}

		fullPoint[0] = fullPoint[1];
		fullPoint[1] += vUp * L1 * 0.005;
		for (int i = 0; i < 2; i++) {
			fullPoint[0].rotateBy(ARX_PI, vN, p0);
			fullPoint[1].rotateBy(ARX_PI, vN, p0);
			makeSimpleTube(fullPoint, 0.9 * D, D, cpx);
		}
		
		fullPoint[0] = fullPoint[1];
		fullPoint[1] += vUp * L1 * 0.08;
		for (int i = 0; i < 2; i++) {
			fullPoint[0].rotateBy(ARX_PI, vN, p0);
			fullPoint[1].rotateBy(ARX_PI, vN, p0);
			makeVerySimpleTube(fullPoint, 0.8 * D, cpx);
			makeVerySimpleTube(fullPoint, D, cpx);
			makeFlatDisc(fullPoint[0], vUp, 0.8 * D, 2 * cpx);
		}

		fullPoint[0] = fullPoint[1];
		fullPoint[1] += vUp * L1 * 0.005;
		for (int i = 0; i < 2; i++) {
			fullPoint[0].rotateBy(ARX_PI, vN, p0);
			fullPoint[1].rotateBy(ARX_PI, vN, p0);
			makeVerySimpleTube(fullPoint, 0.8 * D, cpx);
			makeSimpleTube(fullPoint, D, 0.9 * D, cpx);
			makeFlatRing(fullPoint[1], vUp, 0.8 * D, 0.9 * D, 2 * cpx);
		}

		char* bport;
		get_val("bport", bport);
		double deltaB = B2 - 0.5 * B1, i = 1;
		if (strcmp(bport, "Right") == 0)
			i = -1;
		else 
			i = 1;
		fullPoint[1] = p0 - vCr * i * B2;
		fullPoint[0] = fullPoint[1] + i * vCr * deltaB * 0.05;

		makeVerySimpleTube(fullPoint, 0.8 * D, cpx);
		makeSimpleTube(fullPoint, D, 0.9 * D, cpx);
		makeFlatRing(fullPoint[1], vCr, 0.8 * D, 0.9 * D, 2 * cpx);


		fullPoint[1] = fullPoint[0];
		fullPoint[0] = fullPoint[1] + i * vCr * deltaB * 0.8;

		makeVerySimpleTube(fullPoint, 0.8 * D, cpx);
		makeVerySimpleTube(fullPoint, D, cpx);
		makeFlatDisc(fullPoint[0], vCr, 0.8 * D, 2 * cpx);

		fullPoint[1] = fullPoint[0];
		fullPoint[0] = fullPoint[1] + i * vCr * deltaB * 0.05;
		makeSimpleTube(fullPoint, 0.9 * D, D, cpx);

		fullPoint[1] = fullPoint[0];
		fullPoint[0] = fullPoint[1] + i * vCr * deltaB * 0.1;
		makeFacettedCylinder(fullPoint[0], fullPoint[1], vN, 1.2 * D, 0, 360, 14, true, true);
		delete(bport);
	}
	else {

		fullPoint[0] = p0 + vUp * L1 * 0.4;
		fullPoint[1] = p0 + vUp * L1 * 0.43;
		for (int i = 0; i < 2; i++) {
			fullPoint[0].rotateBy(ARX_PI, vN, p0);
			fullPoint[1].rotateBy(ARX_PI, vN, p0);
			makeVerySimpleTube(fullPoint, 0.5 * (D1 + D2), cpx);
			makeFlatDisc(fullPoint[1], vUp, 0.5 * (D1 + D2), cpx);
			makeFlange(fullPoint[1], (i == 0 ? -1 : 1) * vUp, vN, 0.07 * L1 / 0.9, D1, D2, D3, D4, D5, D6, D7);
		}

		char* bport;
		get_val("bport", bport);
		double deltaB = B2 - 0.5 * B1, i = 1;
		if (strcmp(bport, "Right") == 0)
			i = -1;
		else
			i = 1;
		
		fullPoint[1] = p0 - vCr * i * B2;
		fullPoint[0] = fullPoint[1] + i * vCr * L1 * 0.07;
		makeFlange(fullPoint[0], -i * vCr, vN, 0.07 * L1 / 0.9, D1, D2, D3, D4, D5, D6, D7);
		
		fullPoint[1] = fullPoint[0];
		fullPoint[0] = p0 - vCr * i * (0.5 * B1 + 0.1 * deltaB);
		makeVerySimpleTube(fullPoint, 0.5 * (D1 + D2), cpx);
		makeFlatDisc(fullPoint[1], vCr, 0.5 * (D1 + D2), cpx);

		fullPoint[1] = fullPoint[0];
		fullPoint[0] += i * vCr * 0.1 * deltaB;
		makeFacettedCylinder(fullPoint[0], fullPoint[1], vN, 0.6 * (D1 + D2), 0, 360, 14, true, true);
		delete(bport);

	}
	delete(conn_type);

	return 0;
}


void GRUNDFOSBlockCreator::makeMAGNA3()
{
	double A1 = 111, A2 = 190, A3 = 180, A4 = 158, A5 = 69;
	double B1 = 239, B2 = 54, B3 = 185, B4 = 1.5, B5 = 58, B6 = 71;
	double C1 = 90, C2 = 113, C3 = 25;
	get_val("a1", A1);
	get_val("a2", A2);
	get_val("a3", A3);
	get_val("a4", A4);
	get_val("a5", A5);

	get_val("b1", B1);
	get_val("b2", B2);
	get_val("b3", B3);
	get_val("b4", B4);
	get_val("b5", B5);
	get_val("b6", B6);

	get_val("c1", C1);
	get_val("c2", C2);
	get_val("c3", C3);

	FdPoint3d cP;
	setMeshColor(47, 47, 47);
	//make right
	FdPoint3d fullPoint[2] = { cP, cP };
	fullPoint[1].x += 0.09 * B3;
	makeVerySimpleTube(fullPoint, 2 * B5, cpx);
	makeFlatDisc(fullPoint[0], vx, 2 * B5, cpx);
	makeFlatDisc(fullPoint[1], vx, 2 * B5, cpx);
	//make coupler
	setMeshColor(255, 255, 255);
	FdPoint3d bendPoint = fullPoint[1];
	bendPoint.x += 0.06 * B3;
	bendPoint.y -= 0.475 * 2 * B5;
	bool sides[4] = { true, true, true, true };
	makeBend2(bendPoint, vz, vx, sides, false, 90, 90, 0.05 * 2 * B5, 0.09 * B3, 0.05 * 2 * B5, cpx, 0.45 * 2 * B5, 0.45 * 2 * B5);
	makeBend2(bendPoint, -vz, -vx, sides, false, 90, 90, 0.05 * 2 * B5, 0.09 * B3, 0.05 * 2 * B5, cpx, 0.45 * 2 * B5, 0.45 * 2 * B5);

	bendPoint.z += 0.475 * 2 * B5;
	bendPoint.y += 0.475 * 2 * B5;
	makeBend2(bendPoint, -vy, -vx, sides, false, 88, 88, 0.05 * 2 * B5, 0.09 * B3, 0.05 * 2 * B5, cpx, 0.45 * 2 * B5, 0.45 * 2 * B5);
	bendPoint.z -= 0.95 * 2 * B5;
	makeBend2(bendPoint, vy, -vx, sides, true, 88, 88, 0.05 * 2 * B5, 0.09 * B3, 0.05 * 2 * B5, cpx, 0.45 * 2 * B5, 0.45 * 2 * B5);
	FdPoint3d centerRotatePoint = fullPoint[1];
	centerRotatePoint.x += 0.06 * B3;
	bendPoint.rotateBy(ARX_PI / 180 * 88, vx, centerRotatePoint);
	FdVector3d normalV = vy;
	FdVector3d upV = vz;
	normalV.rotateBy(ARX_PI / 180 * 88, vx);
	upV.rotateBy(ARX_PI / 180 * 88, vx);
	makeRectFace(bendPoint, normalV, upV, 0.05 * 2 * B5, 0.09 * B3);

	bendPoint.rotateBy(ARX_PI / 180 * 4, vx, centerRotatePoint);
	normalV.rotateBy(ARX_PI / 180 * 4, vx);
	upV.rotateBy(ARX_PI / 180 * 4, vx);
	makeRectFace(bendPoint, normalV, upV, 0.05 * 2 * B5, 0.09 * B3);

	FdPoint3d tubePoints[2] = { centerRotatePoint, centerRotatePoint };
	tubePoints[0].z -= 0.55 * 2 * B5;
	tubePoints[1].z -= 0.55 * 2 * B5;
	tubePoints[0].x -= 0.05 * B3;
	tubePoints[1].x += 0.05 * B3;
	tubePoints[0].rotateBy(ARX_PI / 180 * 82.5, vx, centerRotatePoint);
	tubePoints[1].rotateBy(ARX_PI / 180 * 82.5, vx, centerRotatePoint);
	makeVerySimpleTube(tubePoints, 0.1 * 2 * B5, cpx);
	tubePoints[0] = tubePoints[1];
	tubePoints[0].x += 0.01 * B3;
	makeSimpleTube(tubePoints, 0.08 * 2 * B5, 0.1 * 2 * B5, cpx);
	makeFlatDisc(tubePoints[0], vx, 0.08 * 2 * B5, cpx);

	tubePoints[1].x -= 0.11 * B3;
	tubePoints[0].x -= 0.11 * B3;
	makeSimpleTube(tubePoints, 0.1 * 2 * B5, 0.08 * 2 * B5, cpx);
	makeFlatDisc(tubePoints[1], vx, 0.08 * 2 * B5, cpx);
	tubePoints[1].x += 0.11 * B3;


	tubePoints[0].rotateBy(ARX_PI / 180 * 15, vx, centerRotatePoint);
	tubePoints[1].rotateBy(ARX_PI / 180 * 15, vx, centerRotatePoint);
	makeVerySimpleTube(tubePoints, 0.1 * 2 * B5, cpx);
	tubePoints[0] = tubePoints[1];
	tubePoints[0].x += 0.01 * B3;
	makeSimpleTube(tubePoints, 0.08 * 2 * B5, 0.1 * 2 * B5, cpx);
	makeFlatDisc(tubePoints[0], vx, 0.08 * 2 * B5, cpx);

	tubePoints[1].x -= 0.11 * B3;
	tubePoints[0].x -= 0.11 * B3;
	makeSimpleTube(tubePoints, 0.1 * 2 * B5, 0.08 * 2 * B5, cpx);
	makeFlatDisc(tubePoints[1], vx, 0.08 * 2 * B5, cpx);
	tubePoints[1].x += 0.11 * B3;

	tubePoints[0].x += 0.05 * B3;
	tubePoints[1].x -= 0.05 * B3;
	tubePoints[0].z += 0.075 * 2 * B5;
	makeVerySimpleTube(tubePoints, 0.07 * 2 * B5, cpx);
	makeVerySimpleTube(tubePoints, 0.05 * 2 * B5, cpx);
	makeFlatRing(tubePoints[0], vz, 0.06 * 2 * B5, 0.07 * 2 * B5, cpx);
	tubePoints[0].z -= 0.55 * 2 * B5;
	makeVerySimpleTube(tubePoints, 0.06 * 2 * B5, cpx);
	tubePoints[1] = tubePoints[0];
	tubePoints[1].z -= 2;
	makeSimpleTube(tubePoints, 0.06 * 2 * B5, 0.05 * 2 * B5, cpx);
	makeFlatDisc(tubePoints[1], vz, 0.05 * 2 * B5, cpx);
	setMeshColor(47, 47, 47);
	//end make coupler
	fullPoint[0] = fullPoint[1];
	fullPoint[1].x += 0.105 * B3;
	makeVerySimpleTube(fullPoint, 2 * B5 * 0.9, cpx);
	makeFlatDisc(fullPoint[0], vx, 2 * B5 * 0.9, cpx);
	makeFlatDisc(fullPoint[1], vx, 2 * B5 * 0.9, cpx);

	fullPoint[0] = fullPoint[1];
	fullPoint[1].x += 0.185 * B3;
	makeVerySimpleTube(fullPoint, 2 * B5 * 0.7, cpx);

	fullPoint[0] = fullPoint[1];
	fullPoint[1].x += 0.05 * B3;
	makeSimpleTube(fullPoint, 2 * B5 * 0.7, 2 * B5 * 0.75, cpx);
	makeFlatDisc(fullPoint[0], vx, 2 * B5 * 0.7, cpx);
	makeFlatDisc(fullPoint[1], vx, 2 * B5 * 0.75, cpx);

	//make regulator
	fullPoint[0] = fullPoint[1];
	fullPoint[1].x += 0.24 * B3;
	fullPoint[0].y += 0.87 * A1;
	fullPoint[1].y += 0.87 * A1;
	FdVector3d normalVectors[2] = { vx,vx };
	FdVector3d upVectors[2] = { vz,vz };
	double diams[2][2] = { {A4, 2 * (A5 + 0.87 * A1)}, {A4, 2 * (A5 + 0.87 * A1)} };
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);
	fullPoint[1] = fullPoint[0];
	diams[0][0] = diams[0][1] = 0.1;
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);

	FdPoint3d boxPoints[2] = { fullPoint[0], fullPoint[0] };
	boxPoints[0].x += 0.12 * B3;
	boxPoints[1].x += 0.12 * B3;
	boxPoints[1].y = cP.y;
	normalVectors[0] = normalVectors[1] = vy;
	upVectors[0] = upVectors[1] = vx;
	double tabWidth[2] = { A4, 2 * A5 };
	double tabHeight[2] = { 0.24 * B3 , 0.24 * B3 };
	bool side[4] = { true,true,true,true };
	//makeBox(1, boxPoints, normalVectors, upVectors, tabWidth, tabHeight, side, true, true, 0, 0, 0);
	makeSuperBox(boxPoints[0], boxPoints[1], normalVectors, upVectors, tabHeight, tabWidth);
	boxPoints[1].y = boxPoints[0].y + 0.13 * A1;
	tabWidth[1] *= 0.9;
	//makeBox(1, boxPoints, normalVectors, upVectors, tabWidth, tabHeight, side, true, true, 0, 0, 0);
	makeSuperBox(boxPoints[0], boxPoints[1], normalVectors, upVectors, tabHeight, tabWidth);
	tubePoints[0] = boxPoints[0];
	tubePoints[1] = boxPoints[1];
	tubePoints[0].z += tabWidth[0] * 0.5;
	tubePoints[1].z += tabWidth[1] * 0.5;
	tubePoints[0].y = tubePoints[1].y = boxPoints[0].y - 0.065 * A1;
	tubePoints[0].x -= 0.12 * B3;
	tubePoints[1].x += 0.12 * B3;
 	boxPoints[1].y = cP.y;
	tubePoints[0] = tubePoints[1] = boxPoints[1];
	tubePoints[0].x -= 0.12 * B3;
	tubePoints[1].x += 0.12 * B3;
	makeVerySimpleTube(tubePoints, 2 * A5, cpx);
	makeFlatDisc(tubePoints[0], vx, 2 * A5, cpx);
	makeFlatDisc(tubePoints[1], vx, 2 * A5, cpx);
	normalVectors[0] = normalVectors[1] = vx;
	upVectors[0] = upVectors[1] = vz;

	fullPoint[1].x += 0.24 * B3;
	upVectors[0] = upVectors[1] = -vz;
	diams[0][0] = A4;
	diams[0][1] = diams[1][1] = 2 * A1 * 0.13;
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);
	fullPoint[1] = fullPoint[0];
	diams[0][0] = diams[0][1] = 0.1;
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);
	fullPoint[1].x += 0.24 * B3;
	diams[0][0] = A4;

	setMeshColor(255, 0, 0);
	fullPoint[0] = fullPoint[1];
	fullPoint[1].x += 0.24 * B3;
	upVectors[0] = upVectors[1] = vz;
	diams[0][1] = diams[1][1] = 2 * (A5 + 0.87 * A1);
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);

	upVectors[0] = upVectors[1] = -vz;
	diams[0][1] = diams[1][1] = 2 * A1 * 0.13;
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);

	boxPoints[0] = boxPoints[1] = fullPoint[0];
	boxPoints[0].x += 0.12 * B3;
	boxPoints[1].x += 0.12 * B3;
	boxPoints[1].y = cP.y;
	normalVectors[0] = normalVectors[1] = vy;
	upVectors[0] = upVectors[1] = vx;
	tabWidth[0] = A4;
	tabWidth[1] = 2 * A5;
	tabHeight[0] = 0.24 * B3;
	tabHeight[1] = 0.24 * B3;
	//makeBox(1, boxPoints, normalVectors, upVectors, tabWidth, tabHeight, side, true, true, 0, 0, 0);
	makeSuperBox(boxPoints[0], boxPoints[1], normalVectors, upVectors, tabHeight, tabWidth);
	boxPoints[1].y = boxPoints[0].y + 0.13 * A1;
	tabWidth[1] *= 0.9;
	//makeBox(1, boxPoints, normalVectors, upVectors, tabWidth, tabHeight, side, true, true, 0, 0, 0);
	makeSuperBox(boxPoints[0], boxPoints[1], normalVectors, upVectors, tabHeight, tabWidth);
	boxPoints[1].y = cP.y;
	tubePoints[0] = tubePoints[1] = boxPoints[1];
	tubePoints[0].x -= 0.12 * B3;
	tubePoints[1].x += 0.12 * B3;
	makeVerySimpleTube(tubePoints, 2 * A5, cpx);
	makeFlatDisc(tubePoints[0], vx, 2 * A5, cpx);
	makeFlatDisc(tubePoints[1], vx, 2 * A5, cpx);
	normalVectors[0] = normalVectors[1] = vx;
	upVectors[0] = upVectors[1] = vz;

	upVectors[0] = upVectors[1] = -vz;
	diams[0][0] = A4;
	diams[0][1] = diams[1][1] = 2 * A1 * 0.13;
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);
	fullPoint[1] = fullPoint[0];
	diams[0][0] = diams[0][1] = 0.1;
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);
	fullPoint[1].x += 0.24 * B3;
	diams[0][0] = A4;

	setMeshColor(47, 47, 47);
	fullPoint[0] = fullPoint[1];
	fullPoint[1].x += 0.08 * B3;
	upVectors[0] = upVectors[1] = vz;
	diams[0][1] = diams[1][1] = 2 * (A5 + 0.87 * A1);
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);

	fullPoint[0] = fullPoint[1];
	diams[0][0] = diams[0][1] = 0.1;
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);
	fullPoint[0].x -= 0.08 * B3;
	diams[0][0] = A4;

	boxPoints[0] = boxPoints[1] = fullPoint[0];
	boxPoints[0].x += 0.04 * B3;
	boxPoints[1].x += 0.04 * B3;
	boxPoints[1].y = cP.y;
	normalVectors[0] = normalVectors[1] = vy;
	upVectors[0] = upVectors[1] = vx;
	tabWidth[0] = A4;
	tabWidth[1] = 2 * A5;
	tabHeight[0] = 0.08 * B3;
	tabHeight[1] = 0.08 * B3;
	//makeBox(1, boxPoints, normalVectors, upVectors, tabWidth, tabHeight, side, true, true, 0, 0, 0);
	makeSuperBox(boxPoints[0], boxPoints[1], normalVectors, upVectors, tabHeight, tabWidth);
	boxPoints[1].y = boxPoints[0].y + 0.13 * A1;
	tabWidth[1] *= 0.9;
	//makeBox(1, boxPoints, normalVectors, upVectors, tabWidth, tabHeight, side, true, true, 0, 0, 0);
	makeSuperBox(boxPoints[0], boxPoints[1], normalVectors, upVectors, tabHeight, tabWidth);

	boxPoints[1].y = cP.y;
	tubePoints[0] = tubePoints[1] = boxPoints[1];
	tubePoints[0].x -= 0.04 * B3;
	tubePoints[1].x += 0.04 * B3;
	makeVerySimpleTube(tubePoints, 2 * A5, cpx);
	makeFlatDisc(tubePoints[0], vx, 2 * A5, cpx);
	makeFlatDisc(tubePoints[1], vx, 2 * A5, cpx);
	normalVectors[0] = normalVectors[1] = vx;
	upVectors[0] = upVectors[1] = vz;

	upVectors[0] = upVectors[1] = -vz;
	diams[0][1] = diams[1][1] = 2 * A1 * 0.13;
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);
	fullPoint[0] = fullPoint[1];
	diams[0][0] = diams[0][1] = 0.1;
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, true, false);
	fullPoint[0].x -= 0.08 * B3;
	diams[0][0] = A4;
	//make screw
	fullPoint[0].y = cP.y + 0.87 * A1;
	fullPoint[0].x -= 0.15 * B3;
	fullPoint[0].y -= 0.05 * A1;
	for (int i = 0; i < 4; i++) {
		setMeshColor(255, 0, 0);
		FdPoint3d screwPoints[2] = { fullPoint[0], fullPoint[0] };
		screwPoints[0].y += 0.02 * A1;
		screwPoints[1].y += 0.02 * A1;
		if (i < 3) {
			screwPoints[0].y -= i * 0.255 * A1;
			screwPoints[1].y -= i * 0.255 * A1;
			screwPoints[1].z -= 0.5 * A3 - B4;
			makeVerySimpleTube(screwPoints, 0.17 * A1, cpx);
			setMeshColor(47, 47, 47);
			screwPoints[0] = screwPoints[1];
			screwPoints[1].z -= B4;
			makeVerySimpleTube(screwPoints, 0.17 * A1, cpx);
			makeFlatDisc(screwPoints[1], vz, 0.17 * A1, cpx);
		}
		else {
			screwPoints[0].y = 0;
			screwPoints[1].y = 0;
			screwPoints[1].z -= 0.45 * A4 - B4;
			makeVerySimpleTube(screwPoints, 0.17 * A1, cpx);
			setMeshColor(47, 47, 47);
			screwPoints[0] = screwPoints[1];
			screwPoints[1].z -= 0.05 * A4;
			makeFlatRing(screwPoints[0], vz, 0.14 * A1, 0.17 * A1, cpx);
			makeVerySimpleTube(screwPoints, 0.14 * A1, cpx);

			screwPoints[0] = screwPoints[1];
			screwPoints[1].z -= B4;
			makeFlatDisc(screwPoints[0], vz, 0.17 * A1, cpx);
			makeVerySimpleTube(screwPoints, 0.17 * A1, cpx);
			makeFlatDisc(screwPoints[1], vz, 0.17 * A1, cpx);
			makeScrew(screwPoints[1], -vz, vx, 0.17 * A1 * 1.155, 0.4 * (A3 - A4) - B4, true, true);

			screwPoints[1].z -= 0.4 * (A3 - A4) - B4;
			screwPoints[0] = screwPoints[1];
			screwPoints[1].z -= 0.1 * (A3 - A4) + B4;
			makeVerySimpleTube(screwPoints, 0.17 * A1, cpx);
			makeScrew(screwPoints[1], -vz, vx, 0.17 * A1 * 1.155, 0.8 * 0.5 * (A2 - A4), true, true);
			screwPoints[1].z -= 0.8 * 0.5 * (A2 - A4);
			makeDonutSection(screwPoints[1], vz, vx, 0.085 * A1 - 0.2 * 0.5 * (A2 - A4), 0.4 * 0.5 * (A2 - A4), 360, cpx, 2 * cpx);
		}
	}
	fullPoint[0] = fullPoint[1];
	fullPoint[0].y -= 0.085 * A1;
	fullPoint[0].x -= 0.52 * B3;
	boxPoints[0] = boxPoints[1] = fullPoint[0];
	boxPoints[1].z -= 0.51 * A3;
	tabWidth[0] = tabWidth[1] = 0.07 * B3;
	tabHeight[0] = tabHeight[1] = 0.12 * A1;
	side[1] = side[3] = false;
	normalVectors[0] = normalVectors[1] = vz;
	upVectors[0] = upVectors[1] = vx;
	makeBox(1, boxPoints, normalVectors, upVectors, tabHeight, tabWidth, side, false, false, 0, 0, 0);
	tabWidth[0] -= 2;
	tabWidth[1] -= 2;
	makeBox(1, boxPoints, normalVectors, upVectors, tabHeight, tabWidth, side, false, false, 0, 0, 0);

	boxPoints[0] = boxPoints[1];
	tabWidth[1] += 2;
	makeBox(1, boxPoints, normalVectors, upVectors, tabHeight, tabWidth, side, false, false, 0, 0, 0);

	boxPoints[0].z += 0.5 * A3;
	boxPoints[0].y += tabHeight[0] * 0.5;
	boxPoints[1].y += tabHeight[0] * 0.5;
	diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = tabWidth[0];
	makeTube(boxPoints, normalVectors, upVectors, diams, cpx, 1, true, false);
	diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = tabWidth[0] - 2;
	makeTube(boxPoints, normalVectors, upVectors, diams, cpx, 1, true, false);
	boxPoints[0] = boxPoints[1];
	diams[0][0] = diams[0][1] = tabWidth[0];
	makeTube(boxPoints, normalVectors, upVectors, diams, cpx, 1, true, false);

	boxPoints[0].z += 0.5 * A3;
	boxPoints[0].y -= tabHeight[0];
	boxPoints[1].y -= tabHeight[0];
	upVectors[0] = upVectors[1] = -vx;
	diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = tabWidth[0];
	makeTube(boxPoints, normalVectors, upVectors, diams, cpx, 1, true, false);
	diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = tabWidth[0] - 2;
	makeTube(boxPoints, normalVectors, upVectors, diams, cpx, 1, true, false);
	boxPoints[0] = boxPoints[1];
	diams[0][0] = diams[0][1] = tabWidth[0];
	makeTube(boxPoints, normalVectors, upVectors, diams, cpx, 1, true, false);

	for (int i = -1; i <= 1; i++) {
		FdPoint3d screwPoint1 = fullPoint[0];
		screwPoint1.y += i * 0.06 * A1;
		FdPoint3d screwPoint2 = screwPoint1;
		screwPoint2.z -= 0.5 * A3;
		makeFacettedCylinder(screwPoint1, screwPoint2, vx, 0.025 * B3, 0, 360, 4, true, true);
	}
	//end make screw
	setMeshColor(255, 255, 255);
	fullPoint[0] = fullPoint[1];
	fullPoint[0].y = cP.y;
	fullPoint[1].y = cP.y;
	fullPoint[1].x += 0.1;
	makeVerySimpleTube(fullPoint, 2 * B5, cpx);
	makeVerySimpleTube(fullPoint, 2 * B5 * 0.98, cpx);
	makeFlatRing(fullPoint[1], vx, 2 * B5 * 0.98, 2 * B5, cpx);

	normalVectors[0] = normalVectors[1] = vx;
	upVectors[0] = upVectors[1] = vz;
	tabWidth[0] = tabWidth[1] = 0.3 * 2 * B5;
	tabHeight[0] = tabHeight[1] = 0.4 * 2 * B5;
	makeBox(1, fullPoint, normalVectors, upVectors, tabHeight, tabWidth, sides, true, true, 0, 0, 0);
	setMeshColor(47, 47, 47);
	//end make rugulator
	//end make right
	//make  left
	fullPoint[0] = fullPoint[1] = cP;
	fullPoint[1].x -= 0.25 * B2;
	makeSimpleTube(fullPoint, 2 * B5 * 0.8, 2 * B5 * 0.5, cpx);
	fullPoint[0] = fullPoint[1];
	fullPoint[1].x -= 0.16 * B2;
	makeVerySimpleTube(fullPoint, 2 * B5 * 0.5, cpx);
	makeFlatDisc(fullPoint[1], vx, 2 * B5 * 0.5, cpx);

	fullPoint[0] = fullPoint[1] = cP;
	fullPoint[0].x -= 0.125 * B2;
	fullPoint[1].x -= 0.125 * B2;
	fullPoint[1].y -= 0.45 * 2 * B5;
	normalVectors[0] = normalVectors[1] = vy;
	upVectors[0] = upVectors[1] = vx;
	tabWidth[0] = tabWidth[1] = 0.25 * B2;
	tabHeight[0] = tabHeight[1] = 0.2 * 2 * B5;
	makeBox(1, fullPoint, normalVectors, upVectors, tabHeight, tabWidth, sides, true, true, 0, 0, 0);

	fullPoint[0] = fullPoint[1] = cP;
	fullPoint[0].x -= 0.25 * B2;
	fullPoint[1].x -= 0.25 * B2;
	fullPoint[1].y += 0.45 * 2 * B5;
	tabWidth[0] = tabWidth[1] = 0.5 * B2;
	tabHeight[0] = tabHeight[1] = 0.3 * 2 * B5;
	makeBox(1, fullPoint, normalVectors, upVectors, tabHeight, tabWidth, sides, true, true, 0, 0, 0);


	fullPoint[0].x -= 0.25 * B2;
	fullPoint[1].x -= 0.25 * B2;
	makeVerySimpleTube(fullPoint, tabHeight[0], cpx);
	makeFlatDisc(fullPoint[0], vy, tabHeight[0], cpx);
	makeFlatDisc(fullPoint[1], vy, tabHeight[0], cpx);
	fullPoint[1].y += 0.01;
	makeSymbolicCircle(fullPoint[1], vy, 0.4 * tabHeight[0]);
	fullPoint[1].y -= 0.01;

	fullPoint[0].x -= 0.5 * tabHeight[0];
	fullPoint[1].x -= 0.5 * tabHeight[0];
	makeVerySimpleTube(fullPoint, 2 * (0.5 * B2 - 0.5 * tabHeight[0]), cpx);
	makeFlatDisc(fullPoint[0], vy, 2 * (0.5 * B2 - 0.5 * tabHeight[0]), cpx);
	makeFlatDisc(fullPoint[1], vy, 2 * (0.5 * B2 - 0.5 * tabHeight[0]), cpx);

	fullPoint[1].y += 0.01;
	makeSymbolicCircle(fullPoint[1], vy, 0.5 * (0.5 * B2 - 0.5 * tabHeight[0]));
	fullPoint[1].y -= 0.01;


	fullPoint[0] = fullPoint[1] = cP;
	double latAngles[2] = { 0,90 };
	double longAngles[2] = { 0,180 };
	double diameter[3] = { 1.5 * B2,2 * B5 * 0.3,  2 * B5 * 0.9 };
	int n[2] = { cpx,2 * cpx };
	makeSpheroidSection(fullPoint[0], vx, -vy, latAngles, longAngles, diameter, n);

	makeDonutSection(fullPoint[0], vx, -vy, 2 * B5 * 0.375, 2 * B5 * 0.15, 180, cpx, 2 * cpx);
	centerRotatePoint = cP;
	normalV = -vz;
	normalV.rotateBy(ARX_PI / 180 * 160, vx);
	fullPoint[0].y -= 2 * B5 * 0.375;
	fullPoint[0].rotateBy(ARX_PI / 180 * 160, vx, centerRotatePoint);
	fullPoint[1].y += B5 - 0.6 * C3;
	diams[0][0] = diams[0][1] = 2 * B5 * 0.15;
	diams[1][0] = diams[1][1] = 1.2 * C3;
	normalVectors[0] = normalV;
	normalVectors[1] = vz;
	upVectors[0] = upVectors[1] = vx;
	makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, false, false);



	//make donut to connect bottom 
	fullPoint[0] = fullPoint[1] = cP;
	fullPoint[0].x -= 0.41 * B2;
	fullPoint[1].x -= 0.41 * B2;
	fullPoint[0].z -= 2 * B5 * 0.15;
	if (C3 == 25)
		makeDonutSection(fullPoint[0], -vy, vz, 2 * B5 * 0.15, 1.5 * C3, 120, cpx, 2*cpx);
	else
		makeDonutSection(fullPoint[0], -vy, vz, 2 * B5 * 0.15, 1.2 * C3, 120, cpx, 2 * cpx);
	// end make donut to connect bottom 
	
	//maketube to connect bottom
	centerRotatePoint = fullPoint[0];
	fullPoint[0].z += 2 * B5 * 0.15;
	normalV = vx;
	normalV.rotateBy(ARX_PI / 180 * 120, -vy);
	upV = vz;
	upV.rotateBy(ARX_PI / 180 * 30, vy);
	fullPoint[0].rotateBy(ARX_PI / 180 * 120, -vy, centerRotatePoint);
	//centerRotatePoint.rotateBy(ARX_PI / 180 * 180, -vy, fullPoint[0]);
	//makeDonutSection(centerRotatePoint, vy, upV, 2 * B5 * 0.15, 1.2 * C3, 30, cpx, cpx);
	//fullPoint[0].rotateBy(ARX_PI / 180 * 30, vy, centerRotatePoint);
	//normalV.rotateBy(ARX_PI / 180 * 30, vy);
	if (C3 == 25)
		diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = 1.5 * C3;
	else
		diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = 1.2 * C3;
	normalVectors[0] = normalV;
	normalVectors[1] = vz;
	upVectors[0] = upVectors[1] = vy;
	fullPoint[1] = cP;
	fullPoint[1].z -= 0.5 * A4 - B4;
	makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, false, false);

	// end maketube to connect bottom
	fullPoint[0] = cP;
	fullPoint[0].z -= 0.5 * A4 - B4;
	fullPoint[1] = fullPoint[0];
	fullPoint[1].z -= 0.5 * (A3 - A4);
	for (int i = 0; i < 2; i++) {
		fullPoint[0].z *= -1;
		fullPoint[1].z *= -1;
		makeVerySimpleTube(fullPoint, 1.5 * C3, cpx);
		makeVerySimpleTube(fullPoint, 2 * C3, cpx);
		makeFlatDisc(fullPoint[0], vz, 2 * C3, cpx);
	}

	fullPoint[0] = fullPoint[1];
	fullPoint[1].z -= B4;
	for (int i = 0; i < 2; i++) {
		fullPoint[0].z *= -1;
		fullPoint[1].z *= -1;
		makeSimpleTube(fullPoint, 1.5 * C3, 1.55 * C3, cpx);
		makeSimpleTube(fullPoint, 2 * C3, 1.95 * C3, cpx);
		makeFlatRing(fullPoint[1], vz, 1.5 * C3, 1.95 * C3, cpx);
	}
	//make tube connect to top
	fullPoint[0] = fullPoint[1] = cP;
	fullPoint[0].z += 0.5 * A3 - B4 - 0.5 * (A3 - A4);
	diams[1][0] = 0.7 * C3;
	diams[1][1] = 0.8 * C3;
	//makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, false, false);
	//end make tube connect to top
	double d = 1.2 * C3;
	if (C3 == 25)
		d = 1.5 * C3;
	makeDonutSection(fullPoint[1], vx, vy, B5 - 0.5 * d, d, 60, cpx, 2 * cpx);
	centerRotatePoint = fullPoint[1];
	fullPoint[1].y += B5 - 0.5 * d;
	normalV = -vy;
	upV = vz;
	fullPoint[1].rotateBy(ARX_PI / 180 * 60, vx, centerRotatePoint);
	normalV.rotateBy(ARX_PI / 180 * 60, vx);
	upV.rotateBy(ARX_PI / 180 * 60, vx);

	centerRotatePoint.rotateBy(ARX_PI / 180 * 180, vx, fullPoint[1]);
	makeDonutSection(centerRotatePoint, -vx, normalV, B5 - 0.5 * d, d, 65, cpx, 2 * cpx);

	fullPoint[1].rotateBy(ARX_PI / 180 * 65, -vx, centerRotatePoint);
	upV.rotateBy(ARX_PI / 180 * 65, -vx);
	diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = d;
	normalVectors[0] = vz;
	normalVectors[1] = upV;
	upVectors[0] = upVectors[1] = vx;
	makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, false, false);

	fullPoint[0] = cP;
	fullPoint[0].y += B5 - 0.5 * d;
	makeFlatDisc(fullPoint[0], vz, d, cpx);
	//end make left
}	

void GRUNDFOSBlockCreator::makeSuperBox(FdPoint3d startPoint, FdPoint3d endPoint, FdVector3d normalVector[2], FdVector3d upVector[2], double tabHeight[2], double tabWidth[2])
{
	FdPoint3d boxPoints[2] = { startPoint, startPoint };
	double weightArray[20];
	double sum = 0;

	for (int i = 1; i <= 20; i++) {
		weightArray[i - 1] = i;
		sum += i;
	}
	for (int i = 0; i < 20; i++) {
		weightArray[i] /= sum;
	}

	double distanceY = (endPoint.y - startPoint.y) / 20.0;
	double deltaWidth = tabWidth[1] - tabWidth[0];
	double tabWidths[2] = { tabWidth[0], tabWidth[0] };
	bool side[4] = { true, true, true, true };

	for (int i = 0; i < 20; i++) {
		boxPoints[0] = boxPoints[1];
		boxPoints[1].y += distanceY;

		tabWidths[0] = tabWidths[1];
		tabWidths[1] += deltaWidth * weightArray[i];

		makeBox(1, boxPoints, normalVector, upVector, tabWidths, tabHeight, side, true, true, 0, 0, 0);
	}

}

void GRUNDFOSBlockCreator::makeRoundedBox(FdPoint3d startPoint, FdPoint3d endPoint, FdVector3d normalVector, FdVector3d upVector, double tabHeight[2], double tabWidth[2], double radius, bool side[4])
{
	FdVector3d crossVector = normalVector.crossProduct(upVector);
	FdPoint3d boxPoints[2] = { startPoint, endPoint };
	FdVector3d normalVectors[2] = { normalVector, normalVector };
	FdVector3d upVectors[2] = { upVector, upVector };
	double tabHeight1[2] = { tabHeight[0] - 2 * radius, tabHeight[1]  - 2 * radius};
	double tabWidth1[2] = { tabWidth[0] - 2 * radius, tabWidth[1]  - 2 * radius};
	makeBox(1, boxPoints, normalVectors, upVectors, tabHeight1, tabWidth, side, true, true, 0, 0, 0);
	makeBox(1, boxPoints, normalVectors, upVectors, tabHeight, tabWidth1, side, true, true, 0, 0, 0);

	FdPoint3d tubePoints[2] = { startPoint + upVector * (0.5 * tabWidth[0] - radius) + crossVector * (0.5 * tabHeight[0] - radius),
								endPoint + upVector * (0.5 * tabWidth[1] - radius) + crossVector * (0.5 * tabHeight[1] - radius) };
	for (int i = 0; i < 2; i++) {
		tubePoints[0].rotateBy(ARX_PI, normalVector, startPoint);
		tubePoints[1].rotateBy(ARX_PI, normalVector, startPoint);
		makeFlatDisc(tubePoints[0], normalVector, 2 * radius, cpx);
		makeVerySimpleTube(tubePoints, 2 * radius, cpx);
		makeFlatDisc(tubePoints[1], normalVector, 2 * radius, cpx);
	}

	tubePoints[0] = startPoint - upVector * (0.5 * tabWidth[0] - radius) + crossVector * (0.5 * tabHeight[0] - radius);
	tubePoints[1] = endPoint - upVector * (0.5 * tabWidth[1] - radius) + crossVector * (0.5 * tabHeight[1] - radius);
	for (int i = 0; i < 2; i++) {
		tubePoints[0].rotateBy(ARX_PI, normalVector, startPoint);
		tubePoints[1].rotateBy(ARX_PI, normalVector, startPoint);
		makeFlatDisc(tubePoints[0], normalVector, 2 * radius, cpx);
		makeVerySimpleTube(tubePoints, 2 * radius, cpx);
		makeFlatDisc(tubePoints[1], normalVector, 2 * radius, cpx);
	}

}

void GRUNDFOSBlockCreator::makeFlange(FdPoint3d startP, FdVector3d normalVector, FdVector3d upVector, double thickness, double D1, double D2, double D3, double D4, double D5, double D6, double D7)
{
	FdPoint3d fullPoints[2] = { startP, startP + normalVector * 0.9 * thickness };
	makeFlatRing(fullPoints[0], normalVector, D1, D4, cpx);
	makeVerySimpleTube(fullPoints, D4, cpx);
	makeVerySimpleTube(fullPoints, D1, cpx);
	makeFlatRing(fullPoints[1], normalVector, D1, D4, cpx);
	
	fullPoints[0] = fullPoints[1];
	fullPoints[1] += normalVector * 0.1 * thickness;
	makeVerySimpleTube(fullPoints, D1, cpx);
	makeVerySimpleTube(fullPoints, D2, cpx);
	makeFlatRing(fullPoints[1], normalVector, D1, D2, cpx);

}


void GRUNDFOSBlockCreator::makeMAGNA3_FLAGNED()
{
	double A1 = 164, A2 = 204, A3 = 220, A4 = 73, A5 = 106, A6 = 116;
	double B1 = 366, B2 = 65, B3 = 301, B4 = 84, B5 = 86;
	double C1 = 140, C2 = 90, C3 = 76, C4 = 32, C5 = 9;
	double thickOfFlange;
	
	int numOfHoles = 4;
	get_val("a1", A1);
	get_val("a2", A2);
	get_val("a3", A3);
	get_val("a4", A4);
	get_val("a5", A5);
	get_val("a6", A6);
	get_val("b1", B1);
	get_val("b2", B2);
	get_val("b3", B3);
	get_val("b4", B4);
	get_val("b5", B5);
	get_val("c1", C1);
	get_val("c2", C2);
	get_val("c3", C3);
	get_val("c4", C4);
	get_val("c5", C5);
	if (C4 == 32 )
		thickOfFlange = 0.075 * A3;
	else if(C4 == 40)
		thickOfFlange = 0.07 * A3;
	else if (C4 == 50)
		thickOfFlange = 0.065 * A3;
	else if (C4 == 65)
		thickOfFlange = 0.06 * A3;
	else if (C4 == 80)
		thickOfFlange = 0.065 * A3;
	else
		thickOfFlange = 0.055 * A3;
	C2 = 0.5 * (C1 + C3);
	C5 = C2 - C3;
	C5 *= 0.5;
	FdPoint3d cP;
	setMeshColor(047, 47, 47);
	//make right
	FdPoint3d fullPoint[2] = { cP, cP };
	fullPoint[1].x += 0.1295 * B3;
	if (C4 == 32) {
		makeVerySimpleTube(fullPoint, 1.4 * B4, cpx);
		makeFlatDisc(fullPoint[0], vx, 1.4 * B4, cpx);
		makeFlatDisc(fullPoint[1], vx, 1.4 * B4, cpx);
	}
	else {
	
		if (C4 == 50)
			fullPoint[1].x += 0.005 * B3;
		else if (C4 == 65)
			fullPoint[1].x += 0.02 * B3;
		else if (C4 == 80)
			fullPoint[1].x += 0.0345 * B3;
		else if (C4 == 100)
			fullPoint[1].x += 0.06 * B3;
		makeVerySimpleTube(fullPoint, 1.6 * B4, cpx);
		makeFlatDisc(fullPoint[0], vx, 1.6 * B4, cpx);
		makeFlatDisc(fullPoint[1], vx, 1.6 * B4, cpx);
		if (C4 == 50)
			fullPoint[1].x -= 0.005 * B3;
		else if (C4 == 65)
			fullPoint[1].x -= 0.02 * B3;
		else if (C4 == 80)
			fullPoint[1].x -= 0.0345 * B3;
		else if (C4 == 100)
			fullPoint[1].x -= 0.06 * B3;
	}
	
	fullPoint[1].x += 0.1005 * B3;
	makeVerySimpleTube(fullPoint, 1.4 * B4, cpx);
	//make coupler
	setMeshColor(255, 255, 255);
	FdPoint3d bendPoint = fullPoint[0];
	if (C4 == 32)
		bendPoint.x += 0.13 * B3;
	
	else if(C4 == 40)
		bendPoint.x += 0.13 * B3;
	else if (C4 == 50)
		bendPoint.x += 0.135 * B3;
	else if (C4 == 65)
		bendPoint.x += 0.15 * B3;
	else if (C4 == 80)
		bendPoint.x += 0.165 * B3;
	else
		bendPoint.x += 0.188 * B3;
	bendPoint.x += 0.045 * B3;
	bendPoint.y -= 0.75 * B4;
	bool sides[4] = { true, true, true, true };
	makeBend2(bendPoint, vz, vx, sides, false, 90, 90, 0.1 * B4, 0.07 * B3, 0.12 * B4, cpx, 0.7* B4, 0.7* B4);
	makeBend2(bendPoint, -vz, -vx, sides, false, 90, 90, 0.1 * B4, 0.07 * B3, 0.16 * B4, cpx, 0.7* B4, 0.7* B4);

	bendPoint.z += 0.78 * B4;
	bendPoint.y += 0.75 * B4;
	makeBend2(bendPoint, -vy, -vx, sides, false, 88, 88, 0.16 * B4, 0.07 * B3, 0.12 * B4, cpx, 0.7* B4, 0.7* B4);
	bendPoint.z -= 1.54 * B4;
	makeBend2(bendPoint, vy, -vx, sides, true, 88, 88, 0.12 * B4, 0.07 * B3, 0.12 * B4, cpx, 0.7* B4, 0.7* B4);
	FdPoint3d centerRotatePoint = fullPoint[0];
	centerRotatePoint.x = bendPoint.x;
	bendPoint.rotateBy(ARX_PI / 180 * 88, vx, centerRotatePoint);	
	FdVector3d normalV = vy;
	FdVector3d upV = vz;
	normalV.rotateBy(ARX_PI / 180 * 88, vx);
	upV.rotateBy(ARX_PI / 180 * 88, vx);
	makeRectFace(bendPoint, normalV, upV, 0.12 * B4, 0.07 * B3);

	bendPoint.rotateBy(ARX_PI / 180 * 4, vx, centerRotatePoint);
	normalV.rotateBy(ARX_PI / 180 * 4, vx);
	upV.rotateBy(ARX_PI / 180 * 4, vx);
	makeRectFace(bendPoint, normalV, upV, 0.12 * B4, 0.07 * B3);

	FdPoint3d tubePoints[2] = { centerRotatePoint, centerRotatePoint };
	tubePoints[0].z -= 0.9 * B4;
	tubePoints[1].z -= 0.9 * B4;
	tubePoints[0].x -= 0.025 * B3;
	tubePoints[1].x += 0.025 * B3;
	tubePoints[0].rotateBy(ARX_PI / 180 * 82.5, vx, centerRotatePoint);
	tubePoints[1].rotateBy(ARX_PI / 180 * 82.5, vx, centerRotatePoint);
	makeVerySimpleTube(tubePoints, 0.08 * 2 * B4, cpx);
	tubePoints[0] = tubePoints[1];
	tubePoints[0].x += 0.01 * B3;
	makeSimpleTube(tubePoints, 0.06 * 2 * B4, 0.08 * 2 * B4, cpx);
	makeFlatDisc(tubePoints[0], vx, 0.06 * 2 * B4, cpx);

	tubePoints[1].x -= 0.06 * B3;
	tubePoints[0].x -= 0.06 * B3;
	makeSimpleTube(tubePoints, 0.08 * 2 * B4, 0.06 * 2 * B4, cpx);
	makeFlatDisc(tubePoints[1], vx, 0.06 * 2 * B4, cpx);
	tubePoints[1].x += 0.06 * B3;


	tubePoints[0].rotateBy(ARX_PI / 180 * 12.5, vx, centerRotatePoint);
	tubePoints[1].rotateBy(ARX_PI / 180 * 12.5, vx, centerRotatePoint);
	makeVerySimpleTube(tubePoints, 0.08 * 2 * B4, cpx);
	tubePoints[0] = tubePoints[1];
	tubePoints[0].x += 0.01 * B3;
	makeSimpleTube(tubePoints, 0.06 * 2 * B4, 0.08 * 2 * B4, cpx);
	makeFlatDisc(tubePoints[0], vx, 0.06 * 2 * B4, cpx);

	tubePoints[1].x -= 0.06 * B3;
	tubePoints[0].x -= 0.06 * B3;
	makeSimpleTube(tubePoints, 0.08 * 2 * B4, 0.06 * 2 * B4, cpx);
	makeFlatDisc(tubePoints[1], vx, 0.06 * 2 * B4, cpx);
	tubePoints[1].x += 0.06 * B3;

	tubePoints[0].x += 0.025 * B3;
	tubePoints[1].x -= 0.025 * B3;
	tubePoints[0].z += 0.065 * 2 * B4;
	makeVerySimpleTube(tubePoints, 0.07 * 2 * B4, cpx);
	makeVerySimpleTube(tubePoints, 0.05 * 2 * B4, cpx);
	makeFlatRing(tubePoints[0], vz, 0.05 * 2 * B4, 0.07 * 2 * B4, cpx);
	tubePoints[0].z -= 0.4 * 2 * B4;
	makeVerySimpleTube(tubePoints, 0.05 * 2 * B4, cpx);
	tubePoints[1] = tubePoints[0];
	tubePoints[1].z -= 2;
	makeSimpleTube(tubePoints, 0.05 * 2 * B4, 0.04 * 2 * B4, cpx);
	makeFlatDisc(tubePoints[1], vz, 0.04 * 2 * B4, cpx);
	setMeshColor(47, 47, 47);
	//end make coupler
	fullPoint[0] = fullPoint[1];
	fullPoint[1].x += 0.53 * B3;
	makeVerySimpleTube(fullPoint, 2 * B4 * 0.7, cpx);
	//make regulator
	fullPoint[0].x += 0.175 * B3;
	fullPoint[0].y += 0.66 * A1;
	if (C4 >= 65) {
		double delta = 0.13 * B3, step = 0.05 * B3;
		if (C4 == 65) {
			delta = 0.13 * B3;
			step = 0.048 * B3;
		}
		else if (C4 == 80) {
			delta = 0.12 * B3;
			step = 0.048 * B3;
		}
		else if (C4 == 100) {
			delta = 0.095 * B3;
			step = 0.046 * B3;
		}
		fullPoint[0].x -= delta;
		for (int i = 0; i < 10; i++) {
			if (i < 3) {
				tubePoints[0] = tubePoints[1] = fullPoint[0];
				tubePoints[1].y -= (0.66 * A1 + 0.8 * B4) * 0.4;
				FdVector3d normalVectors[2] = { vy, vy };
				FdVector3d upVectors[2] = { vx,vx };
				double tabHeight[2] = { A2, A2 * 0.8 };
				double tabWidth[2] = { 0.01 * B3, 0.01 * B3 };
				makeSuperBox(fullPoint[0], fullPoint[1], normalVectors, upVectors, tabWidth, tabHeight);
				if (i == 1) {
					tubePoints[0] = tubePoints[1] = fullPoint[0];
					tubePoints[1].y += 0.1 * A1;
					tubePoints[0].z += 0.25 * A2;
					tubePoints[1].z += 0.25 * A2;
					makeVerySimpleTube(tubePoints, 0.035 * B3, cpx);
					makeFlatDisc(tubePoints[1], vy, 0.035 * B3, cpx);
					tubePoints[0].z -= 0.5 * A2;
					tubePoints[1].z -= 0.5 * A2;
					makeVerySimpleTube(tubePoints, 0.035 * B3, cpx);
					makeFlatDisc(tubePoints[1], vy, 0.035 * B3, cpx);
				}
				
			}
			else {
				tubePoints[0] = tubePoints[1] = fullPoint[0];
				tubePoints[0].x -= 0.005 * B3;
				tubePoints[1].x += 0.005 * B3;
				FdVector3d normalVectors[2] = { vx, vx };
				FdVector3d upVectors[2] = { vz,vz };
				double diams[2][2] = { {A2, 2 * (0.66 * A1 + 0.8 * B4)}, {A2, 2 * (0.66 * A1 + 0.8 * B4)} };
				makeTube(tubePoints, normalVectors, upVectors, diams, cpx, 1, true, false);

				tubePoints[0] = tubePoints[1];
				diams[0][0] = diams[0][1] = 0.1;
				makeTube(tubePoints, normalVectors, upVectors, diams, cpx, 1, true, false);

				tubePoints[0].x -= 0.01 * B3;
				tubePoints[1].x -= 0.01 * B3;
				makeTube(tubePoints, normalVectors, upVectors, diams, cpx, 1, true, false);
				//makeVerySimpleTube(tubePoints, 20, cpx);
			}
			
			fullPoint[0].x += step;
		}

		fullPoint[0].x += delta - step * 10 + 0.05 * B3 * 7;
	}
	else {
		for (int i = 0; i < 7; i++) {
			tubePoints[0] = tubePoints[1] = fullPoint[0];
			tubePoints[0].x -= 0.005 * B3;
			tubePoints[1].x += 0.005 * B3;
			FdVector3d normalVectors[2] = { vx, vx };
			FdVector3d upVectors[2] = { vz,vz };
			double diams[2][2] = { {A2, 2 * (0.66 * A1 + 0.8 * B4)}, {A2, 2 * (0.66 * A1 + 0.8 * B4)} };
			makeTube(tubePoints, normalVectors, upVectors, diams, cpx, 1, true, false);

			tubePoints[0] = tubePoints[1];
			diams[0][0] = diams[0][1] = 0.1;
			makeTube(tubePoints, normalVectors, upVectors, diams, cpx, 1, true, false);

			tubePoints[0].x -= 0.01 * B3;
			tubePoints[1].x -= 0.01 * B3;
			makeTube(tubePoints, normalVectors, upVectors, diams, cpx, 1, true, false);
			//makeVerySimpleTube(tubePoints, 20, cpx);
			fullPoint[0].x += 0.05 * B3;
		}
	}
	

	fullPoint[0].x -= 0.185 * B3;
	FdVector3d normalVectors[2] = { vy, vy };
	FdVector3d upVectors[2] = { vx,vx };
	double tabHeight[2] = { 0.36 * B3, 0.36 * B3 };
	double tabWidth[2] = { A2, A2 };
	if (C4 == 80) {
		fullPoint[0].x += 0.01 * B3;
		tabHeight[0] = tabHeight[1] = 0.34 * B3;
	}
	else if (C4 == 100) {
		fullPoint[0].x += 0.02 * B3;
		tabHeight[0] = tabHeight[1] = 0.32 * B3;
	}
	fullPoint[1] = fullPoint[0];
	fullPoint[1].y += 0.25 * A1;
	makeBox(1, fullPoint, normalVectors, upVectors, tabWidth, tabHeight, sides, true, true, 0, 0, 0);
	if (C4 <= 50) {

		double tabHeight1[2];
		double tabWidth1[2];
		
		tubePoints[0] = fullPoint[0];
		if (C4 == 32)
			tubePoints[0].x -= 0.02 * B3;
		else if(C4 == 50)
			tubePoints[0].x -= 0.01 * B3;
		tubePoints[0].x -= tabHeight[0] * 0.5;
		tubePoints[1] = tubePoints[0];
		tubePoints[1].y += 0.2 * A1;
		tubePoints[0].y -= (0.66 * A1 + 0.8 * B4) * 0.4;
		tabHeight1[0] = tabHeight1[1] = 0.04 * B3;
		tabWidth1[0] = tabWidth1[1] = 0.08 * A2;
		tubePoints[0].z += 0.16 * A2;
		tubePoints[1].z += 0.16 * A2;
		makeBox(1, tubePoints, normalVectors, upVectors, tabWidth1, tabHeight1, sides, true, true, 0, 0, 0);
		tubePoints[0].z -= 0.32 * A2;
		tubePoints[1].z -= 0.32 * A2;
		makeBox(1, tubePoints, normalVectors, upVectors, tabWidth1, tabHeight1, sides, true, true, 0, 0, 0);
		tubePoints[0].x -= 0.5 * tabWidth1[0];
		tubePoints[1].x -= 0.5 * tabWidth1[0];

		makeVerySimpleTube(tubePoints, tabWidth1[0], cpx);
		makeFlatDisc(tubePoints[1], vy, tabWidth1[0], cpx);
		tubePoints[0].z += 0.32 * A2;
		tubePoints[1].z += 0.32 * A2;
		makeVerySimpleTube(tubePoints, tabWidth1[0], cpx);
		makeFlatDisc(tubePoints[1], vy, tabWidth1[0], cpx);
	}
	else if (C4 >= 65) {
		double delta = 0.13 * B3;
		if (C4 > 65)
			delta = 0.135 * B3;
		tubePoints[0] = fullPoint[0];
		tubePoints[0].x -= tabHeight[0] * 0.5 + 0.5 * delta;
		tubePoints[1] = tubePoints[0];
		tubePoints[1].y += 0.02 * A1;
		double tabHeight1[2] = { delta, delta };
		double tabWidth1[2] = { A2, A2 };
		makeBox(1, tubePoints, normalVectors, upVectors, tabWidth1, tabHeight1, sides, true, true, 0, 0, 0);
		
		tubePoints[0] = fullPoint[0];
		tubePoints[0].x -= tabHeight[0] * 0.5 ;
		tubePoints[1] = tubePoints[0];
		tubePoints[1].y += 0.2 * A1;
		tabHeight1[0] = tabHeight1[1] = 0.04 * B3;
		tabWidth1[0] = tabWidth1[1] = 0.08 * A2;
		tubePoints[0].z += 0.16 * A2;
		tubePoints[1].z += 0.16 * A2;
		makeBox(1, tubePoints, normalVectors, upVectors, tabWidth1, tabHeight1, sides, true, true, 0, 0, 0);
		tubePoints[0].z -= 0.32 * A2;
		tubePoints[1].z -= 0.32 * A2;
		makeBox(1, tubePoints, normalVectors, upVectors, tabWidth1, tabHeight1, sides, true, true, 0, 0, 0);
		tubePoints[0].x -= 0.5 * tabWidth1[0];
		tubePoints[1].x -= 0.5 * tabWidth1[0];

		makeVerySimpleTube(tubePoints, tabWidth1[0], cpx);
		makeFlatDisc(tubePoints[1], vy, tabWidth1[0], cpx);
		tubePoints[0].z += 0.32 * A2;
		tubePoints[1].z += 0.32 * A2;
		makeVerySimpleTube(tubePoints, tabWidth1[0], cpx);
		makeFlatDisc(tubePoints[1], vy, tabWidth1[0], cpx);
	}
	
	fullPoint[0] = fullPoint[1];
	fullPoint[1].y += 0.09 * A1;
	tabWidth[1] *= 0.9;
	makeSuperBox(fullPoint[0], fullPoint[1], normalVectors, upVectors, tabHeight, tabWidth);
	fullPoint[0].y -= 0.25 * A1;
	tabWidth[1] /= 0.9;

	double diams[2][2];
	setMeshColor(255, 0, 0);
	fullPoint[0].x += 0.105 * B3 + tabHeight[0] * 0.5;
	tabHeight[0] = tabHeight[1] = 0.21 * B3;
	fullPoint[1] = fullPoint[0];
	fullPoint[1].y += 0.25 * A1;
	makeBox(1, fullPoint, normalVectors, upVectors, tabWidth, tabHeight, sides, true, true, 0, 0, 0);
	fullPoint[0] = fullPoint[1];
	fullPoint[1].y += 0.09 * A1;
	tabWidth[1] *= 0.9;
	makeSuperBox(fullPoint[0], fullPoint[1], normalVectors, upVectors, tabHeight, tabWidth);
	fullPoint[0].y -= 0.25 * A1;
	tabWidth[1] /= 0.9;
	tubePoints[0] = tubePoints[1] = fullPoint[0];
	tubePoints[0].x -= 0.1 * B3;
	tubePoints[1].x += 0.1 * B3;
	diams[0][0] = diams[1][0] = A2;
	diams[0][1] = diams[1][1] = 2 * (0.66 * A1 + 0.8 * B4);
	normalVectors[0] = normalVectors[1] = vx;
	upVectors[0] = upVectors[1] = vz;
	makeTube(tubePoints, normalVectors, upVectors, diams, cpx, 1, true, false);

	tubePoints[1] = tubePoints[0];
	diams[1][0] = diams[1][1] = 0.1;
	makeTube(tubePoints, normalVectors, upVectors, diams, cpx, 1, true, false);
	setMeshColor(47, 47, 47);
	fullPoint[0].x += 0.02 * B3 + tabHeight[0] * 0.5;
	tabHeight[0] = tabHeight[1] = 0.04 * B3;
	fullPoint[1] = fullPoint[0];
	fullPoint[1].y += 0.25 * A1;
	normalVectors[0] = normalVectors[1] = vy;
	upVectors[0] = upVectors[1] = vx;
	makeBox(1, fullPoint, normalVectors, upVectors, tabWidth, tabHeight, sides, true, true, 0, 0, 0);
	fullPoint[0] = fullPoint[1];
	fullPoint[1].y += 0.09 * A1;
	tabWidth[1] *= 0.9;
	makeSuperBox(fullPoint[0], fullPoint[1], normalVectors, upVectors, tabHeight, tabWidth);
	fullPoint[0].y -= 0.25 * A1;
	tabWidth[1] /= 0.9;

	tubePoints[0] = tubePoints[1] = fullPoint[0];
	tubePoints[0].x -= 0.02 * B3;
	tubePoints[1].x += 0.02 * B3;
	normalVectors[0] = normalVectors[1] = vx;
	upVectors[0] = upVectors[1] = vz;
	diams[0][0] = diams[1][0] = A2;
	diams[0][1] = diams[1][1] = 2 * (0.66 * A1 + 0.8 * B4);
	makeTube(tubePoints, normalVectors, upVectors, diams, cpx, 1, true, false);
	tubePoints[0] = tubePoints[1];
	diams[0][0] = diams[0][1] = 0.1;
	makeTube(tubePoints, normalVectors, upVectors, diams, cpx, 1, true, false);

	setMeshColor(255, 255, 255);
	fullPoint[0] = cP;
	fullPoint[0].x += B3;
	fullPoint[1] = fullPoint[0];
	fullPoint[1].x += 0.1;
	makeVerySimpleTube(fullPoint, 2 * B4 * 0.75, cpx);
	makeVerySimpleTube(fullPoint, 2 * B4 * 0.73, cpx);
	makeFlatRing(fullPoint[1], vx, 2 * B4 * 0.73, 2 * B4 * 0.75, cpx);

	normalVectors[0] = normalVectors[1] = vx;
	upVectors[0] = upVectors[1] = vz;
	tabWidth[0] = tabWidth[1] = 0.2 * 2 * B4;
	tabHeight[0] = tabHeight[1] = 0.3 * 2 * B4;
	makeBox(1, fullPoint, normalVectors, upVectors, tabHeight, tabWidth, sides, true, true, 0, 0, 0);

	//make screw
	fullPoint[0].x -= 0.105 * B3;
	fullPoint[0].y += 0.5 * A1;
	for (int i = 0; i < 2; i++) {
		setMeshColor(255, 0, 0);
		tubePoints[0] = tubePoints[1] = fullPoint[0];
		tubePoints[1].z -= 0.5 * A2 - 1.5;
		tubePoints[0].y += 0.1 * A1;
		tubePoints[1].y += 0.1 * A1;
		makeVerySimpleTube(tubePoints, 0.06 * B3, cpx);
		tubePoints[0].y -= 0.2 * A1;
		tubePoints[1].y -= 0.2 * A1;
		makeVerySimpleTube(tubePoints, 0.06 * B3, cpx);
		tubePoints[0].y -= 0.2 * A1;
		tubePoints[1].y -= 0.2 * A1;
		tubePoints[1].z += 1.5;
		makeVerySimpleTube(tubePoints, 0.06 * B3, cpx);
		tubePoints[0].y += 0.4 * A1;
		tubePoints[1].y += 0.4 * A1;
		tubePoints[1].z -= 1.5;

		setMeshColor(47, 47, 47);
		tubePoints[0] = tubePoints[1];
		tubePoints[1].z -= 1.5;
		makeVerySimpleTube(tubePoints, 0.06 * B3, cpx);
		makeFlatDisc(tubePoints[1], vz, 0.06 * B3, cpx);
		tubePoints[0].y -= 0.2 * A1;
		tubePoints[1].y -= 0.2 * A1;
		makeVerySimpleTube(tubePoints, 0.06 * B3, cpx);
		makeFlatDisc(tubePoints[1], vz, 0.06 * B3, cpx);
		tubePoints[0].y -= 0.2 * A1;
		tubePoints[1].y -= 0.2 * A1;
		tubePoints[0].z += 1.5;
		tubePoints[1].z += 1.5;
		
		makeFlatDisc(tubePoints[1], vz, 0.06 * B3, cpx);
		if (i == 1) {
			tubePoints[0].z += 4;
			makeScrew(tubePoints[0], -vz, vx, 0.09 * B3, 6, true, true);
			tubePoints[0].z -= 6;
			tubePoints[1] = tubePoints[0];
			tubePoints[1].z -= 4;
			makeVerySimpleTube(tubePoints, 0.07 * B3, cpx);
			makeScrew(tubePoints[1], -vz, vx, 0.09 * B3, 12, true, true);
			tubePoints[1].z -= 12;
			makeDonutSection(tubePoints[1], vz, vx, 0.02 * B3, 0.02 * B3, 360, cpx, 2 * cpx);
		}
		else {
			makeVerySimpleTube(tubePoints, 0.06 * B3, cpx);
		}
		fullPoint[0].x -= 0.09 * B3;
	}
	//end make screw
	//end make regulator
	//end make right
	//make left
	
	//make flange
	fullPoint[0] = fullPoint[1] = cP;
	fullPoint[1].z -= 0.5 * A3 - thickOfFlange;
	fullPoint[0] = fullPoint[1];
	fullPoint[1].z -= thickOfFlange -3;
	tubePoints[0] = tubePoints[1] = fullPoint[1];
	tubePoints[1].z -= 3;
	for (int i = 0; i < 2; i++) {
		fullPoint[0].z *= -1;
		fullPoint[1].z *= -1;
		tubePoints[0].z *= -1;
		tubePoints[1].z *= -1;
		/*makeVerySimpleTube(fullPoint, C1, cpx);
		makeFlatDisc(fullPoint[0], vz, C1, cpx);
		makeFlatDisc(fullPoint[1], vz, C1, cpx);*/
		double alfa = 20;
		if (C4 == 32)
			alfa = 30;
		else if (C4 == 40)
			alfa = 30;
		else if (C4 == 50)
			alfa = 30;
		else if (C4 == 65)
			alfa = 40;
		else if (C4 == 80)
			alfa = 20;
		else
			alfa = 20;
		makeFacettedCylinder(fullPoint[0], fullPoint[1], -vx, C1, alfa, 360 - alfa, 30, true, true);
		tabHeight[0] = tabHeight[1] = C1 * cos(alfa * ARX_PI / 180);
		tabWidth[0] = tabWidth[1] = C1 * sin(alfa * ARX_PI / 180);
		normalVectors[0] = normalVectors[1] = vz;
		upVectors[0] = upVectors[1] = vx;
		makeBox(1, fullPoint, normalVectors, upVectors, tabWidth, tabHeight, sides, true, true, 0, 0, 0);

		makeVerySimpleTube(tubePoints, C3, cpx);
		makeVerySimpleTube(tubePoints, C4, cpx);
		makeFlatRing(tubePoints[1], vz, C3, C4, cpx);
		
	}

	tubePoints[0] = fullPoint[0];
	tubePoints[1] = fullPoint[1];
	tubePoints[0].z += 0.01;
	tubePoints[1].z -= 0.01;	
	tubePoints[0].x += 0.5 * C2;
	tubePoints[1].x += 0.5 * C2;
	double alfa = ARX_PI * 2 / numOfHoles;
	tubePoints[0].rotateBy(alfa * 0.5, vz, fullPoint[0]);
	tubePoints[1].rotateBy(alfa * 0.5, vz, fullPoint[1]);
	for (int i = 0; i < 2; i++) {
		tubePoints[0].z *= -1;
		tubePoints[1].z *= -1;
		for (int j = 0; j < numOfHoles; j++) {
			tubePoints[0].rotateBy(alfa, vz, fullPoint[0]);
			tubePoints[1].rotateBy(alfa, vz, fullPoint[1]);
			makeSymbolicCircle(tubePoints[0], vz, C5);
			makeSymbolicCircle(tubePoints[1], vz, C5);
		}
	}
	// end make flange
	if (C4 == 32) {
		//make  left
		B4 *= 0.7;
		fullPoint[0] = fullPoint[1] = cP;
		fullPoint[1].x -= 0.25 * B2;
		makeSimpleTube(fullPoint, 2 * B4 * 0.8, 2 * B4 * 0.5, cpx);
		fullPoint[0] = fullPoint[1];
		fullPoint[1].x -= 0.16 * B2;
		makeVerySimpleTube(fullPoint, 2 * B4 * 0.5, cpx);
		makeFlatDisc(fullPoint[1], vx, 2 * B4 * 0.5, cpx);

		fullPoint[0] = fullPoint[1] = cP;
		fullPoint[0].x -= 0.125 * B2;
		fullPoint[1].x -= 0.125 * B2;
		fullPoint[1].y -= 0.45 * 2 * B4;
		normalVectors[0] = normalVectors[1] = vy;
		upVectors[0] = upVectors[1] = vx;
		tabWidth[0] = tabWidth[1] = 0.25 * B2;
		tabHeight[0] = tabHeight[1] = 0.2 * 2 * B4;
		makeBox(1, fullPoint, normalVectors, upVectors, tabHeight, tabWidth, sides, true, true, 0, 0, 0);

		fullPoint[0] = fullPoint[1] = cP;
		fullPoint[0].x -= 0.25 * B2;
		fullPoint[1].x -= 0.25 * B2;
		fullPoint[1].y += 0.45 * 2 * B4;
		tabWidth[0] = tabWidth[1] = 0.5 * B2;
		tabHeight[0] = tabHeight[1] = 0.3 * 2 * B4;
		makeBox(1, fullPoint, normalVectors, upVectors, tabHeight, tabWidth, sides, true, true, 0, 0, 0);


		fullPoint[0].x -= 0.25 * B2;
		fullPoint[1].x -= 0.25 * B2;
		makeVerySimpleTube(fullPoint, tabHeight[0], cpx);
		makeFlatDisc(fullPoint[0], vy, tabHeight[0], cpx);
		makeFlatDisc(fullPoint[1], vy, tabHeight[0], cpx);
		fullPoint[1].y += 0.01;
		makeSymbolicCircle(fullPoint[1], vy, 0.4 * tabHeight[0]);
		fullPoint[1].y -= 0.01;

		fullPoint[0].x -= 0.5 * tabHeight[0];
		fullPoint[1].x -= 0.5 * tabHeight[0];
		makeVerySimpleTube(fullPoint, 2 * (0.5 * B2 - 0.5 * tabHeight[0]), cpx);
		makeFlatDisc(fullPoint[0], vy, 2 * (0.5 * B2 - 0.5 * tabHeight[0]), cpx);
		makeFlatDisc(fullPoint[1], vy, 2 * (0.5 * B2 - 0.5 * tabHeight[0]), cpx);

		fullPoint[1].y += 0.01;
		makeSymbolicCircle(fullPoint[1], vy, 0.5 * (0.5 * B2 - 0.5 * tabHeight[0]));
		fullPoint[1].y -= 0.01;


		fullPoint[0] = fullPoint[1] = cP;
		double latAngles[2] = { 0,90 };
		double longAngles[2] = { 0,180 };
		double diameter[3] = { 1.5 * B2,2 * B4 * 0.3,  2 * B4 * 0.9 };
		int n[2] = { cpx,2*cpx };
		makeSpheroidSection(fullPoint[0], vx, -vy, latAngles, longAngles, diameter, n);

		makeDonutSection(fullPoint[0], vx, -vy, 2 * B4 * 0.375, 2 * B4 * 0.15, 180, cpx, 2 * cpx);
		centerRotatePoint = cP;
		normalV = -vz;
		normalV.rotateBy(ARX_PI / 180 * 160, vx);
		fullPoint[0].y -= 2 * B4 * 0.375;
		fullPoint[0].rotateBy(ARX_PI / 180 * 160, vx, centerRotatePoint);
		fullPoint[1].y += B4 - 0.6 * C4;
		diams[0][0] = diams[0][1] = 2 * B4 * 0.15;
		diams[1][0] = diams[1][1] = 1.2 * C4;
		normalVectors[0] = normalV;
		normalVectors[1] = vz;
		upVectors[0] = upVectors[1] = vx;
		makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, false, false);



		//make donut to connect bottom 
		fullPoint[0] = fullPoint[1] = cP;
		fullPoint[0].x -= 0.41 * B2;
		fullPoint[1].x -= 0.41 * B2;
		fullPoint[0].z -= 2 * B4 * 0.15;
		makeDonutSection(fullPoint[0], -vy, vz, 2 * B4 * 0.15, 1.2 * C4, 120, cpx, 2 * cpx);
		// end make donut to connect bottom 

		//maketube to connect bottom
		centerRotatePoint = fullPoint[0];
		fullPoint[0].z += 2 * B4 * 0.15;
		normalV = vx;
		normalV.rotateBy(ARX_PI / 180 * 120, -vy);
		upV = vz;
		upV.rotateBy(ARX_PI / 180 * 30, vy);
		fullPoint[0].rotateBy(ARX_PI / 180 * 120, -vy, centerRotatePoint);
		//centerRotatePoint.rotateBy(ARX_PI / 180 * 180, -vy, fullPoint[0]);
		//makeDonutSection(centerRotatePoint, vy, upV, 2 * B4 * 0.15, 1.2 * C4, 30, cpx, cpx);
		//fullPoint[0].rotateBy(ARX_PI / 180 * 30, vy, centerRotatePoint);
		//normalV.rotateBy(ARX_PI / 180 * 30, vy);
		diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = 1.2 * C4;
		normalVectors[0] = normalV;
		normalVectors[1] = vz;
		upVectors[0] = upVectors[1] = vy;
		fullPoint[1] = cP;
		fullPoint[1].z -= 0.5 * A3 - thickOfFlange;
		makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, false, false);

		// end maketube to connect bottom

		//make tube connect to top

		
		fullPoint[0] = fullPoint[1] = cP;
		fullPoint[0].z += 0.5 * A3 - thickOfFlange;
		makeDonutSection(fullPoint[1], vx, vy, B4 - 0.6 * C4, 1.2 * C4, 60, cpx, 2 * cpx);
		centerRotatePoint = fullPoint[1];
		fullPoint[1].y += B4 - 0.6 * C4;
		normalV = -vy;
		upV = vz;
		fullPoint[1].rotateBy(ARX_PI / 180 * 60, vx, centerRotatePoint);
		normalV.rotateBy(ARX_PI / 180 * 60, vx);
		upV.rotateBy(ARX_PI / 180 * 60, vx);

		centerRotatePoint.rotateBy(ARX_PI / 180 * 180, vx, fullPoint[1]);
		makeDonutSection(centerRotatePoint, -vx, normalV, B4 - 0.6 * C4, 1.2 * C4, 65, cpx, 2 * cpx);

		fullPoint[1].rotateBy(ARX_PI / 180 * 65, -vx, centerRotatePoint);
		upV.rotateBy(ARX_PI / 180 * 65, -vx);
		diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = 1.2 * C4;
		normalVectors[0] = vz;
		normalVectors[1] = upV;
		upVectors[0] = upVectors[1] = vx;
		makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, false, false);

		fullPoint[0] = cP;
		fullPoint[0].y += B4 - 0.6 * C4;
		makeFlatDisc(fullPoint[0], vz, 1.2 * C4, cpx);
		//end make tube connect to top
		//end make left
	}
	else {
		fullPoint[0] = fullPoint[1] = cP;
		normalV = vx;
		normalV.rotateBy(ARX_PI / 180 * 5, vy);
		if (C4 >= 65) {
			makeDonutSection(fullPoint[0], normalV, vy, B4 - 0.4 * B4, 0.8 * B4, 360, cpx, 2 * cpx);
			fullPoint[1].x -= 0.4 * B4;
			fullPoint[1].rotateBy(ARX_PI / 180 * 5, vy, fullPoint[0]);
			makeFlatDisc(fullPoint[1], normalV, 2 * (B4 - 0.4 * B4), cpx);
			fullPoint[1].x += 0.1 * B4;
			makeDonutSection(fullPoint[1], vx, vy, 0.5 * B4 - 0.2 * B4, 0.4 * B4, 360, cpx, 2 * cpx);
			fullPoint[1].x -= 0.2 * B4;
			makeFlatDisc(fullPoint[1], vx, 2 * (0.5 * B4 - 0.2 * B4), cpx);
		}

		else {
			makeDonutSection(fullPoint[0], normalV, vy, 0.8 * B4 - 0.1 * B4, 0.2 * B4, 360, cpx, 2 * cpx);
			fullPoint[1].x -= 0.1 * B4;
			fullPoint[1].rotateBy(ARX_PI / 180 * 5, vy, fullPoint[0]);
			makeFlatDisc(fullPoint[1], normalV, 2 * (0.8 * B4 - 0.1 * B4), cpx);
		}


		fullPoint[0].z -= 0.5 * B4;
		makeDonutSection(fullPoint[0], -vy, vz, 0.5 * B4, 1.2 * C4, 110, cpx, 2 * cpx);

		centerRotatePoint = fullPoint[0];
		fullPoint[0].z += 0.5 * B4;
		fullPoint[0].rotateBy(ARX_PI / 180 * 110, -vy, centerRotatePoint);
		normalV = vx;
		normalV.rotateBy(ARX_PI / 180 * 110, -vy);
		fullPoint[1] = cP;
		fullPoint[1].z -= 0.5 * A3 - thickOfFlange;
		normalVectors[0] = normalV;
		normalVectors[1] = vz;
		upVectors[0] = upVectors[1] = vy;
		diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = 1.2 * C4;
		makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, false, false);

		fullPoint[0] = fullPoint[1] = cP;
	/*	if(C4 > 65)
			fullPoint[1].x += 0.14 * B3 - 0.6 * C4;*/

		double radius;
		if (C4 >= 65)
			radius = 0.9 * B4;
		else
			radius = B4 - 0.6 * C4;
		makeDonutSection(fullPoint[1], vx, -vz, radius, 1.2 * C4, 150, cpx, 2 * cpx);
		centerRotatePoint = fullPoint[1];
		fullPoint[1].z -= radius;
		normalV = vy;
		normalV.rotateBy(ARX_PI / 180 * 150, vx);
		upV = -vz;
		upV.rotateBy(ARX_PI / 180 * 150, vx);
		fullPoint[1].rotateBy(ARX_PI / 180 * 150, vx, centerRotatePoint);
		centerRotatePoint.rotateBy(ARX_PI / 180 * 180, vx, fullPoint[1]);
		normalV.rotateBy(ARX_PI / 180 * 60, -vx);
		makeDonutSection(centerRotatePoint, -vx, -upV, radius, 1.2 * C4, 60, cpx, 2 * cpx);
		fullPoint[1].rotateBy(ARX_PI / 180 * 60, -vx, centerRotatePoint);

		fullPoint[0] = cP;
		fullPoint[0].z += 0.5 * A3 - thickOfFlange;
		normalVectors[0] = vz;
		normalVectors[1] = normalV;
		upVectors[0] = upVectors[1] = vx;
		diams[0][0] = diams[0][1] = diams[1][0] = diams[1][1] = 1.2 * C4;
		makeTube(fullPoint, normalVectors, upVectors, diams, cpx, 1, false, false);
		if (C4 >= 65) {
			fullPoint[0] = fullPoint[1] = cP;
			//fullPoint[0].z -= B4;
			//fullPoint[0].x += 0.07 * B3;
			fullPoint[1].z -= 0.45 * A3;
			normalVectors[0] = normalVectors[1] = vz;
			upVectors[0] = upVectors[1] = vx;
			tabHeight[0] = tabHeight[1] = 1;
			tabWidth[0] = 1.2 * C4;
			tabWidth[1] = 1.2 * C4;
			bool side[4] = { true, true, true, true };
			makeBox(1, fullPoint, normalVectors, upVectors, tabHeight, tabWidth, side, true, true, 0, 0, 0);
		}

		normalVectors[0] = normalVectors[1] = vy;
		upVectors[0] = upVectors[1] = vx;
		fullPoint[0] = fullPoint[1] = cP;
		fullPoint[0].x -= 0.125 * B2;
		fullPoint[1].x -= 0.125 * B2;
		fullPoint[1].y += 0.45 * 2 * B4;
		tabWidth[0] = tabWidth[1] = 0.25 * B2;
		tabHeight[0] = tabHeight[1] = 0.3 * 2 * B4;
		bool side[4] = { true, true, true, true };
		makeBox(1, fullPoint, normalVectors, upVectors, tabHeight, tabWidth, side, true, true, 0, 0, 0);


		fullPoint[0].x -= 0.125 * B2;
		fullPoint[1].x -= 0.125 * B2;
		makeVerySimpleTube(fullPoint, tabHeight[0], cpx);
		makeFlatDisc(fullPoint[0], vy, tabHeight[0], cpx);
		makeFlatDisc(fullPoint[1], vy, tabHeight[0], cpx);
		fullPoint[0].x -= 0.5 * tabHeight[0];
		fullPoint[1].x -= 0.5 * tabHeight[0];
		makeVerySimpleTube(fullPoint, 0.5 * tabHeight[0], cpx);
		makeFlatDisc(fullPoint[0], vy, 0.5 * tabHeight[0], cpx);
		makeFlatDisc(fullPoint[1], vy, 0.5 * tabHeight[0], cpx);
		//end make  left
	}
	
	
	
}
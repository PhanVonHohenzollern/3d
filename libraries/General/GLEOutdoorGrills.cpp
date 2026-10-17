#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

#define GLEOutdoorGrills SmkGenBlockCreator


void GLEOutdoorGrills::makeCRC1(double D, double D1, double H, double H1, double H2, double pillar_t, int baseN, int roofN)
{
	// make the base tube
	FdPoint3d p1(0, 0, 0),p2(H-H1-H2, 0, 0),p3,p4;
	makeVerySimpleTube(p1, p2, D, baseN);

	//--- Make the cone roof.  Give it a small diameter
	//--- for the apex, but not so small that nothing is
	//--- drawn.  We want to see the "point" of the apex.
	p1.set(H-H1, 0, 0); p2.set(H, 0, 0);
	makeSimpleTube(p1, p2, D1, .00001, roofN);

	double rotVector[3] = {1, 0, 0};
	FdPoint3d rotPoint(0, 0, 0);
	// make the pillars (which attach the base to the roof)
	int count = 0;
	while(count<6)
	{
		p1.set(H-H1-H2, pillar_t/2, D/2);
		p2.set(H-H1-H2, -pillar_t/2, D/2);
		p3.set(H-H1, -pillar_t/2, D1/2-D1/8);
		p4.set(H-H1, pillar_t/2, D1/2-D1/8);

		FdPoint3d points2[4] = {p1,p2,p3,p4};
		makeRotatablePlane(points2, vx, rotPoint, 60*count);
		count++;
	}
	addCircularConnector(FdPoint3d::kOrigin);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		// make the base tube
		FdPoint3d p1(0, 0, 0),p2(H-H1-H2, 0, 0);
		makeVerySimpleTube(p1, p2, D + 2*size, baseN);

		makeFlatRing(p1, vx, D, D + 2*size, baseN);
		makeFlatRing(p2, vx, D, D + 2*size, baseN);
	}

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		// make the base tube
		FdPoint3d p1(0, 0, 0),p2(H-H1-H2, 0, 0);
		makeVerySimpleTube(p1, p2, D - 2*size, baseN);

		makeFlatRing(p1, vx, D, D - 2*size, baseN);
		makeFlatRing(p2, vx, D, D - 2*size, baseN);
	}
}

void GLEOutdoorGrills::makeRRC1(double a, double b, double l, double flange_1)
{
	postTransformMesh(3 * ARX_PI / 2, FdVector3d::kZAxis);

	double h = 10;  // thickness of this 8 little boxes
	                // so we have only 3+ boxes here:)
	double L = l - 30;

	FdPoint3d p1(0, 0, 0), p2(0, 30, 0), p3(0, 30 + L / 2, 0);

	FdPoint3d centralPoint[3] = { p1, p2, p3 };
	double tabWidth[3] = { a, a, a };
	double tabHeight[3] = { b, b, b };
	bool sides[8] = { true, true, true, true, true, true, true, true };
	bool con[2] = { false, false };
	makeBox(2, centralPoint, tabWidth, tabHeight, sides, con, false, false);

	// 8 boxes, 2 on each side
	// left side
	double smallWidth = 10 + 20 * ((a - 100) / 100);
	p1.set(-b / 2 + h / 2, 30 + L / 2, a / 2 - 20 * (a / 100) - smallWidth / 2);
	p2.set(-b / 2 + h / 2,  l - L / 4, a / 2 - 20 * (a / 100) - smallWidth / 2);
	FdPoint3d p[2] = { p1, p2 };
	double tabWidth1[2]  = { smallWidth, smallWidth };
	double tabHeight1[2] = { h, h };
	bool sides1[8] = { true, true, true, true };
	bool con1[2] = { false, false };
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);

	p1.set(-b / 2 + h / 2, 30 + L / 2, -a / 2 + 20 * (a / 100) + smallWidth / 2);
	p2.set(-b / 2 + h / 2,  l - L / 4, -a / 2 + 20 * (a / 100) + smallWidth / 2);
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);

	// right side
	p1.set(b / 2 - h / 2, 30 + L / 2, a / 2 - 20 * (a / 100) - smallWidth / 2);
	p2.set(b / 2 - h / 2,  l - L / 4, a / 2 - 20 * (a / 100) - smallWidth / 2);
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);

	p1.set(b / 2 - h / 2, 30 + L / 2, -a / 2 + 20 * (a / 100) + smallWidth / 2);
	p2.set(b / 2 - h / 2,  l - L / 4, -a / 2 + 20 * (a / 100) + smallWidth / 2);
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);

	// far
	p1.set(-b / 2 + 20 * (b / 100) + smallWidth / 2, 30 + L / 2, a / 2 - h / 2);
	p2.set(-b / 2 + 20 * (b / 100) + smallWidth / 2,  l - L / 4, a / 2 - h / 2);
	p[0] = p1;  p[1] = p2;
	double tabWidth5[2]  = { h, h };
	double tabHeight5[2] = { smallWidth, smallWidth };
	makeBox(1, p, tabWidth5, tabHeight5, sides1, con1, true, true);

	p1.set(b / 2 - 20 * (b / 100) - smallWidth / 2, 30 + L / 2, a / 2 - h / 2);
	p2.set(b / 2 - 20 * (b / 100) - smallWidth / 2,  l - L / 4, a / 2 - h / 2);
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth5, tabHeight5, sides1, con1, true, true);

	// near
	p1.set(-b / 2 + 20 * (b / 100) + smallWidth / 2, 30 + L / 2, -a / 2 + h / 2);
	p2.set(-b / 2 + 20 * (b / 100) + smallWidth / 2,  l - L / 4, -a / 2 + h / 2);
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth5, tabHeight5, sides1, con1, true, true);

	p1.set(b / 2 - 20 * (b / 100) - smallWidth / 2, 30 + L / 2, -a / 2 + h / 2);
	p2.set(b / 2 - 20 * (b / 100) - smallWidth / 2,  l - L / 4, -a / 2 + h / 2);
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth5, tabHeight5, sides1, con1, true, true);

	// this roof at the top:)
	p1.set(0, l - L / 4, 0);
	p2.set(0, l, 0);
	p[0] = p1;  p[1] = p2;
	double tabWidthC[2]  = { a + 25 * (a / 100), 0.001 };
	double tabHeightC[2] = { b + 25 * (b / 100), 0.001 };
	bool sidesC[8] = { true, true, true, true };
	bool conC[2] = { false, false };
	makeBox(1, p, tabWidthC, tabHeightC, sidesC, conC, false, true);

	p1.set(0, 0, 0);
	addRectangularConnector(p1, vy, vz, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vy, vz, a, b, flange_1);

	p1.set(0, CONNECTOR_WIDTH, 0);
	addThinRect(p1, vy, vz,  a, b);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1(0, 0, 0), p2(0, 30 + L / 2, 0);

		FdPoint3d centralPoint[2] = { p1, p2 };
		FdVector3d v[2] = { vy, vy };
		FdVector3d upV[2] = { vx, vx };
		double tabWidth[2] = { a + 2 * size, a + 2 * size };
		double tabHeight[2] = { b + 2 * size, b + 2 * size };
		bool sides[4] = { true, true, true, true };
		makeBox(1, centralPoint, v, upV, tabWidth, tabHeight, sides, false, false, 5, 0, -size);
		if( flange_1 < size )
			makeRectangularFlange(p1, vy, vz, a + 2 * flange_1, b + 2 * flange_1, size - flange_1);
	}

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		FdPoint3d p1(0, 0, 0), p2(0, 30 + L / 2, 0);

		FdPoint3d centralPoint[2] = { p1, p2 };
		FdVector3d v[2] = { vy, vy };
		FdVector3d upV[2] = { vx, vx };
		double tabWidth[2] = { a - 2 * size, a - 2 * size };
		double tabHeight[2] = { b - 2 * size, b - 2 * size };
		bool sides[4] = { true, true, true, true };
		makeBox(1, centralPoint, v, upV, tabWidth, tabHeight, sides, false, false, 0, 0, size);
	}
}

void GLEOutdoorGrills::makeWG(double L, double H, double n, double a, double thickness, double flange_1)
{
	//--- Make the connecting box.
	FdPoint3d p1(0, 0, 0), p2(40, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabHeight[2] = { H, H };
	double tabWidth[2]  = { L, L };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	// addRectangularConnector(p1, vx, vy, H, L);
	addRectangularConnector(p1, vx, vy, H + 2 * flange_1, L + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, H, L, flange_1);

	//--- Make the grill.
	makeGrillType7(p1, vx, vz, H, L, n, a, thickness);
}





// New outdoor grilles - by PK - 09.05.29

// RRC-B -> command from library "GenRRC-B"
void GLEOutdoorGrills::makeRRCB(double a, double b, double a0, double b0, double h0, double h, double h1, double h2, double h3, double c, double d)
{
	// declaration of additional variables
	// double h = h0/1.49;
	// double h1 = h0/14.88;
	// double h2 = h0/20;
	// double h3 = h0/20;
	// double c = a*1.175;
	// double d = b*1.175;

	// declaration of start / center points
	FdPoint3d p1(0, 0, 0), p2(0, 0, h3);        // for bottom flange
	FdPoint3d p3(0, 0, h0-h);                   // for rectangular connection (end point)
	FdPoint3d p4(0, 0, h0-h), p5(0,0,h0-h+h2);  // start poin and end point of each out grile
	FdPoint3d p6(0, 0, h0-h1), p7(0,0,h0);      // start poin and end point of element cap

	// bottom flange
	double tabWidth[2] = { d, b };
	double tabHeight[2]  = { c, a };

	FdPoint3d centralPoints[2] = { p1, p2 };

	bool sidesC[4] = { true, true, true, true };
	bool conC[2] = { false, false };

	makeBox(1, centralPoints, tabWidth, tabHeight, sidesC, conC, false, false);

	// part of rectangular duct
	tabWidth[0] = b; tabWidth[1] = b;
	tabHeight[0] = a; tabHeight[1] = a;
	centralPoints[0] = p2; centralPoints[1] = p3;

	makeBox(1, centralPoints, tabWidth, tabHeight, sidesC, conC, false, false);

	// repeated out grilles
	int count = 0;

	while (((h0-h)+h2*(count+1))<=(h0-h1))
	{
		p4.set(0,0,(h0-h)+h2*count); p5.set(0,0,(h0-h)+h2*(count+1));

		tabWidth[0] = d; tabWidth[1] = b;
		tabHeight[0] = c; tabHeight[1] = a;
		centralPoints[0] = p4; centralPoints[1] = p5;

		makeBox(1, centralPoints, tabWidth, tabHeight, sidesC, conC, false, false);

		count++;
	}

	// cap
	tabWidth[0] = b0; tabWidth[1] = 0.001;
	tabHeight[0] = a0; tabHeight[1] = 0.001;
	centralPoints[0] = p5;  // here have to be p5 due to small space between grill and cap (which have to be alligned to last grill)
	centralPoints[1] = p7;

	makeBox(1, centralPoints, tabWidth, tabHeight, sidesC, conC, false, false);

	// connector
	addRectangularConnector(p1, vy, vz, c, d);
}

// CRC-D -> command from library GenCRC-D
void GLEOutdoorGrills::makeCRCD(double d, double d0, double h0, double d1, double d2, double h1, int n)
{
	// declaration of additional variables
	// double d1 = d*1.15;
	// double d2 = d*1.39;
	// double h1 = h0*0.02;

	double d3 = (h0-h1)*(d0-d)/h0 + d;  // diameter of main tube in the border of top flange

	// declaration of start / center points
	FdPoint3d p1(0, 0, 0);      // start point of bottom flange
	FdPoint3d p2(0, 0, h0-h1);  // end point of main tube
	FdPoint3d p3(0, 0, h0);     // end point of element

	// bottom flange
	makeFlatRing(p1, vz, d, d1, n);

	// main tube
	double tubeDiams[2] = {d, d3};        // bottom and top diameter of main tube
	FdPoint3d centerPoint[2] = {p1, p2};  // start and end point of main tube

	makeStraightTube(centerPoint, tubeDiams, n, 1, true);

	// top flange
	makeFlatRing(p2, vz, d3, d2, n);

	// top tube
	tubeDiams[0] = d3; tubeDiams[1] = d0;
	centerPoint[0] = p2; centerPoint[1] = p3;

	makeStraightTube(centerPoint, tubeDiams, n, 1, true);

	// connector
	addCircularConnector(p1);
}

// CRC-E -> command from library GenCRC-E
void GLEOutdoorGrills::makeCRCE(double d, double d1, double d2, double h0, double h1, double h2, double h3, double h4, double d0, double d3, int n)
{
	// declaration of additional variables
	// double h1 = h0/6;
	// double h2 = h0/6.6;
	// double h3 = h0/3;
	// double h4 = h0/3;
	// double d0 = d*1.15;
	// double d3 = d*1.575;

	// declaration of start / center points
	FdPoint3d p1(0, 0, 0);         // start point of bottom flange
	FdPoint3d p2(0, 0, h1);        // end point of bottom tube
	FdPoint3d p3(0, 0, h1+h4);     // end point of bottom cone
	FdPoint3d p4(0, 0, h1+h4+h3);  // end point of top cone
	FdPoint3d p5(0, 0, h0);        // end point of top tube

	// bottom flange
	makeFlatRing(p1, vz, d, d0, n);

	// segment
	double segmentDiam[5] = {d, d, d1, d2, d2};       // diameters of each segment
	FdPoint3d centerPoint[5] = {p1, p2, p3, p4, p5};  // center points of each segment

	makeStraightTube(centerPoint, segmentDiam, n, 4, true);

	// top flange
	makeFlatRing(p5, vz, d2, d3, n);

	// connector
	addCircularConnector(p1);
}

// CRC-G -> command from library GenCRC-G
void GLEOutdoorGrills::makeCRCG(double d, double d1, double d2, double h0, double d3, double d4, double d5, double d6,
								double h, double h1, double h2, double h3, double h4, double h5, double h6, int n)
{
	// declaration of additional variables
	// double h = h0/2.41;
	// double h1 = h0/13.18;
	// double h2 = h0/7.25;
	// double h3 = h0/7.25;
	// double h4 = h0/18.125;
	// double h5 = h0/145;
	// double h6 = h0/41.42;

	// // double d0 = d*1.15;
	// double d3 = d*1.725;
	// double d4 = d*1.425;
	// double d5 = d*1.15;
	// double d6 = d*1.525;

	double d7 = (h0-h-h6)*(d2-d4)/(h0-h) + d4;  // diameter of main cone in the border of top flange

	// declaration of start / center points
	FdPoint3d p1(0, 0, 0);            // start point of bottom flange
	FdPoint3d p2(0, 0, h1);           // end point of bottom tube
	FdPoint3d p3(0, 0, h1+h2);        // end point of bottom cone
	FdPoint3d p4(0, 0, h1+h2+h3);     // end point of midle cone
	FdPoint3d p5(0, 0, h1+h2+h3+h4);  // end point of midle tube
	FdPoint3d p6(0, 0, h);            // end point of midle flange
	FdPoint3d p7(0, 0, h0-h6);        // end point of main cone
	FdPoint3d p8(0, 0, h0);           // end point of element

	// bottom flange
	makeFlatRing(p1, vz, d, d5, n);

	// segment
	double segmentDiam[5] = {d, d, d1, d4, d4};       // diameters of each segment
	FdPoint3d centerPoint[5] = {p1, p2, p3, p4, p5};  // center points of each segment

	makeStraightTube(centerPoint, segmentDiam, n, 4, true);

	// midle flange (with width)
	double flangeDiam[2] = {d6, d6};       // diameter of bottom and top space of midle flange
	FdPoint3d flangeCPoint[2] = {p5, p6};  // center point of midle flange


	makeFlatRing(p5, vz, d4, d6, n);
	makeStraightTube(flangeCPoint, flangeDiam, n, 1, true);
	makeFlatRing(p6, vz, d4, d6, n);

	// main cone
	double mainConDiam[2] = {d4, d7};
	FdPoint3d mainConCPoint[2] = {p6, p7};  // center point of midle flange

	makeStraightTube(mainConCPoint, mainConDiam, n, 1, true);

	// top flange
	makeFlatRing(p7, vz, d2, d3, n);

	// top cone
	double topConDiam[2] = {d7, d2};
	FdPoint3d topConCPoint[2] = {p7, p8};  // center point of midle flange

	makeStraightTube(topConCPoint, topConDiam, n, 1, true);

	// connector
	addCircularConnector(p1);
}

// CWG -> command from library GenCWG
void GLEOutdoorGrills::makeCWG(double d, double l, double d1, double h, int n)
{
	// declaration of additional variables
	h = d / 20;

	// declaration of start / center points
	FdPoint3d p1(0, 0, 0);  // start point of tube
	FdPoint3d p2(l, 0, 0);  // start point of flat ring and grill

	// left tube
	double tubeDiam [2] = {d, d};
	FdPoint3d tubeCPoint[2] = {p1, p2};

	makeStraightTube(tubeCPoint, tubeDiam, n, 1, true);

	// grill
	makeFlatRing(p2, vx, 0.001, d1, n);

	// grill symbolic lines
	int count = 0;
	double dh = h;
	double dy = d / 2;
	FdPoint3d s1(l, dy, 0), s2(l, -dy, 0);
	FdPoint3d s3(l, dy, 0), s4(l, -dy, 0);

	// makeSymbolicLine(s1, s2);  // main grill line

	for( ; ; )  // other grilles line
	{
		dh = h * (double) count;
		if( dh >= d / 2 )  break;
		dy = sqrt(d * d * 0.25 - dh * dh);

		s1.set(l, dy,  dh);  s2.set(l, -dy,  dh);
		s3.set(l, dy, -dh);  s4.set(l, -dy, -dh);

		makeSymbolicLine(s1, s2);
		makeSymbolicLine(s3, s4);

		count++;
	}

	// flange
	makeFlatRing(p2, vx, d, d1, n);

	// connector
	addCircularConnector(p1);
}

// CRWG -> command from library GenCRWG
void GLEOutdoorGrills::makeCRWG(double d, double b, double a, double l, double l1, int n)
{
	// declaration of additional variables

	// declaration of start / center points
	FdPoint3d p0(0, -l, 0);  // start point of tube
	FdPoint3d p1(0, 0, 0);   // placing point
	FdPoint3d p2(0, l1, 0);  // start point grill

	// tube
	double tubeDiam [2] = {d, d};
	FdPoint3d tubeCPoint[2] = {p0, p1};

	makeStraightTube(tubeCPoint, tubeDiam, n, 1, true);

	// rectangular plane with circular hole
	double rectDim[2] = {b, a};
	double tubeParams[3] = {d, d, 0};
	makeRectToTubeTransition(p1, vy, vx, rectDim, p1, tubeParams, n);

	// grill
	makePlane(p2, vy, vz, a, b);

	// grill lines
	FdPoint3d s0(b/2, l1, a/2), s1(-b/2, l1, -a/2);
	FdPoint3d s2(-b/2, l1, a/2), s3(b/2, l1, -a/2);

	makeSymbolicLine(s0, s1);
	makeSymbolicLine(s2, s3);

	// conector
	addCircularConnector(p1);
}





// KSO -> command from library GenKSO
void GLEOutdoorGrills::makeKSO(double d, double l, double l2, int n)
{
}

void GLEOutdoorGrills::makeUSMS(double d, double l, double l2, double a, double b, int n)
{
	n = 10;
	l2 = 10;

	FdPoint3d p1(0, 0, 0), p2(l2, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { a - 60, a - 60 };
	double tabHeight[2] = { b - 60, b -60 };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };

	makeBox(1, centralPoints, tabWidth, tabHeight, sides, con, false, false);

	p1.set(0, 0, 0);
	double ab[2] = { a - 60, b - 60 };
	double tubeParams[3] = { d, d, -l };

	makeRectToTubeTransition(p1, vx, vy, ab, p1, tubeParams, n);

	double LGrill = a - 60;
	double HGrill = b - 60;
	double alfa = 45;
	double thick = 2;
	double bladeNo = b/16;

	// p2.set( l2, 0, 0 );
	makeGrillType6(p2, vx, vz, LGrill, HGrill, bladeNo, thick);
	// makeGrillType7(p2, vx, vz, LGrill, HGrill, bladeNo, alfa, thick);
}

void GLEOutdoorGrills::makeTAGF(double d1, double A, double B, double l, double thic, double alfa, int n)
{
	n = 10;
	thic = 5;
	FdVector3d x = vx;
	FdVector3d y = vy;

	FdPoint3d p1(l, 0, 0), p2Box(l/2 + thic, 0, 0);
	FdPoint3d Down[1] = { p1 };

	makeSimpleTube(Down, d1, d1, n);

	p1.set(l / 2, 0, 0);
	double rangl = M_PI * alfa / 180;
	x.rotateBy(rangl, y);

	FdVector3d BoxVec[2] = { x, x };
	FdVector3d UpVec[2] = { y, y };
	FdPoint3d p2BoxBis(p2Box - 0 * x);
	FdPoint3d Box[2] = { p2BoxBis, p1 };
	double TabWidth[2] = { A, A };
	double TabHeight[2] = { B, B };
	double conWidth = 0;
	int con1side = 0;
	int con2side = 0;
	bool sides[4] = { true, true, true, true };
	bool sidesFix[4] = { false, false, false, false };

	makeBox(1, Box, BoxVec, UpVec, TabWidth, TabHeight, sides, true, false, con1side, con2side, conWidth);
	makeBox(1, Box, BoxVec, UpVec, TabWidth, TabHeight, sidesFix, false, true, con1side, con2side, conWidth);
}

void GLEOutdoorGrills::makeWDQE(double c, double h, double a, double b, int n)
{
	n = 10;

	FdPoint3d p1(0, 0, 0), p2(100, 0, 0), p3(100, 0, 0), p4((h / 2) + 50, 0, 0), p5((h / 2 + 50), 0, 0), p6(h, 0, 0);
	FdPoint3d FirstBox[2] = { p1, p2 };
	FdVector3d FirstBoxVec[2] = { vx, vx };
	double tabWidth[2] = { a, a };
	double tabHeight[2] = { b, b };

	makeBox(1, FirstBox, tabWidth, tabHeight, true);

	FdPoint3d SecBox[2] = { p3, p4 };
	double tabWidth2[2] = { a, c };
	double tabHeight2[2] = { b, c };

	makeBox(1, SecBox, tabWidth2, tabHeight2, true);

	FdPoint3d LastBox[2] = { p5, p6 };
	double tabWidth3[2] = { c, a };
	double tabHeight3[2] = { c, b };

	makeBox(1, LastBox, tabWidth3, tabHeight3, false);
}

void GLEOutdoorGrills::makeUSLA(double d1, double a, double b, double l1, double angle, int seg, int n)
{
	setHlrSplineType(hlrOutline);

	n = 10;
	angle = 90;
	seg = 10;

	double radius = d1 * 0.5;
	double rang = M_PI * angle / 180.0;
	double x = radius - (radius - d1 / 2.0) * (1 - cos(rang)) / 2.0;
	double y = (radius + d1 / 2.0) * sin(rang) / 2.0;
	FdPoint3d p1(x, -y,  0 ), p2;
	makeDonutSection(p1, -vz, -vx, radius, d1, angle, n, seg);

	// double mainTubeData[3] = { d1/2, d1/2, d1/2 * 2 };
	// double interPos[2] = { d1/2, 0 };
	// double interData[3] = { d1 / 2 + l1, d1/2, d1/2 };
	// double angles[3] = { 45, 90, 270 };
	// int complex[2] = { n, n };
	// bool bools[2] = { false, true };  // omit the main tube
	// p1.set(x - d1, -y, 0);
	// makeTubeToTubeIntersection(p1, vx, mainTubeData, interPos, interData, angles, complex, bools);

	p1.set(x - radius, -y, 0);
	addCircularConnector(p1);

	FdPoint3d p3(x - radius, -y - l1, 0);
	FdPoint3d Tube[] = { p1, p3 };

	makeFlatRing(p1, vy, d1, b, n);
	makeSimpleTube(Tube, d1, a, n);
}

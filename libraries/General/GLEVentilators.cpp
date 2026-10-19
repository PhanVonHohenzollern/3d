#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define GLEVentilators SmkGenBlockCreator

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

////////////////////////////////////////////BEGINNING OF GENERAL VENTILATORS FUNCTIONS///////////////////////////////////
void GLEVentilators::makeCV1(double diam1, double length1, double length2, double heightWidth, int n)
{
	// make plane with circular hole (left)
	FdPoint3d p1, p2;
	p1.set(-length1/2+length2, 0, 0);
	double heightWidth2[2] = {heightWidth, heightWidth};
	double tubeParams[3] = {diam1, diam1, 0};
	makeRectToTubeTransition(p1, vx, vy, heightWidth2, p1, tubeParams, n);

	// make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
	p1.set(-length1/2+length2, 0, 0); p2.set(-length1/2, 0, 0);
	makeVerySimpleTube(p1, p2, diam1, n);

	// make plane with circular hole (right)
	p1.set(length1/2-length2, 0, 0);
	makeRectToTubeTransition(p1,vx, vy, heightWidth2, p1, tubeParams, n);

	// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
	p1.set(length1/2-length2, 0, 0); p2.set(length1/2, 0, 0);
	makeVerySimpleTube(p1, p2, diam1, n);

	// make the box
	p1.set(-length1/2+length2, 0, 0); p2.set(length1/2-length2, 0, 0);
	FdPoint3d centralPoints[2] = {p1, p2};
	double tabHeight[2]= {heightWidth,heightWidth};
	double tabWidth[2] = {heightWidth,heightWidth};
	makeBox(1,centralPoints,tabWidth,tabHeight,false);

	p1.set(-length1/2, 0, 0);
	addCircularConnector(p1);

	p1.set(length1/2, 0, 0);
	addCircularConnector(p1);

	p1.set(-length1/2+length2, 0, 0);
	drawAsThinArc(p1);

	p1.set(length1/2-length2, 0, 0);
	drawAsThinArc(p1);

	// add approriate symbol to all four sides
	p1.set(0, 0, heightWidth/2);
	makeCircleWithTriangle(p1, vz, vy, (length1-length2*2)/1.5);

	p1.set(0, heightWidth/2, 0);
	makeCircleWithTriangle(p1, vy, -vz, (length1-length2*2)/1.5);

	p1.set(0, 0, -heightWidth/2);
	makeCircleWithTriangle(p1, -vz, -vy, (length1-length2*2)/1.5);

	p1.set(0, -heightWidth/2, 0);
	makeCircleWithTriangle(p1, -vy, vz, (length1-length2*2)/1.5);

	/**********************************Ext Insulation*******************************/
	double size;
	if ( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		diam1 += 2*size; heightWidth += 2 * size;
		/*length1 -= size;*/ length2 -= size;

		FdPoint3d p1, p2;
		p1.set(-length1/2+length2, 0, 0);
		double heightWidth2[2] = {heightWidth, heightWidth};
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vx, vy, heightWidth2, p1, tubeParams, n);

		// make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(-length1/2+length2, 0, 0); p2.set(-length1/2, 0, 0);
		makeVerySimpleTube(p1, p2, diam1, n);

		makeFlatRing(p2, vx, diam1, diam1 -2*size, n);

		// make plane with circular hole (right)
		p1.set(length1/2-length2, 0, 0);
		makeRectToTubeTransition(p1,vx, vy, heightWidth2, p1, tubeParams, n);

		// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
		p1.set(length1/2-length2, 0, 0); p2.set(length1/2, 0, 0);
		makeVerySimpleTube(p1, p2, diam1, n);

		makeFlatRing(p2, vx, diam1, diam1 -2*size, n);

		// make the box
		p1.set(-length1/2+length2, 0, 0); p2.set(length1/2-length2, 0, 0);
		FdPoint3d centralPoints[2] = {p1, p2};
		double tabHeight[2]= {heightWidth,heightWidth};
		double tabWidth[2] = {heightWidth,heightWidth};
		makeBox(1,centralPoints,tabWidth,tabHeight,false);
	}
}

void GLEVentilators::makeCV2(double d, double l2, int n)
{
	double width  = d + 100;
	double height = d + 100;
	double length = 50;

	// FdPoint3d p1(-length / 2.0, 0, 0),
	//           p2( length / 2.0, 0, 0);
	FdPoint3d p1(0, 0, 0), p2(length, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { width, width };
	double tabHeight[2] = { height, height };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };
	makeBox(1, centralPoints, tabWidth, tabHeight, sides, con, false, false);

	// make the plane with circular hole
	l2 += 40;
	p1.set(0, 0, 0);
	double heightWidth[2] = { width, height };
	double tubeParams[3] = { d, d, 0 };
	makeRectToTubeTransition(p1, vx, vy, heightWidth, p1, tubeParams, n);

	// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
	p1.set(-l2, 0, 0);  p2.set(0, 0, 0);
	makeVerySimpleTube(p1,p2, d, n);

	addCircularConnector( p1 );

	// add approriate symbol to all four sides
	double vector[3] = { 0, 0, 1 };
	double downUp[3] = { 1, 0, 0 };
	double center[3] = { 0, 0, width / 2 };
	p1.set(length / 2, 0, width / 2);
	makeInfinite(p1, vz, vx, 20, d);

	p1.set(length / 2, height / 2, 0);
	makeInfinite(p1, vy, vx, 20, d);

	p1.set(length / 2, 0, -width / 2);
	makeInfinite(p1, -vz, vx, 20, d);

	p1.set(length / 2, -height / 2, 0);
	makeInfinite(p1, -vy, vx, 20, d);

	double frame = 10, thickness = 25, alfa = 45;
	double r=5, ln=3, Pl = 22.5, ft = 10;
	double x = thickness * tan(alfa * M_PI / 180);
	double L = width, H = height;

	// get vairables from .pnr file
	double A = L;
	double B = H;

	double C = L + 2 * frame;
	double E = H + 2 * frame;

	// calculate variables

	alfa = atan(thickness / Pl);
	alfa = alfa * 180 / ARX_PI;
	ln = floor( min(A, B) / Pl );
	ln = ln-1;

	// grill
#ifdef DETAILED
	FdPoint3d cp(length / 2, 0, 0);
	makeRectGrillType4(cp, -vx, vy, A, B, thickness, alfa, r, ln, 1);

	p1.set(length / 2 + ft, 0, 0);  p2.set(length / 2, 0, 0);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	FdVector3d v[4] = { -vx, -vx, -vx, -vx };
	FdVector3d upv[4] = { vy, vy, vy, vy };
	double tabWidthb[4] = { A, C, C, A };
	double tabHeightb[4] = { B, E, E, B };
	bool sidesb[12] = { true, true, true, true, true, true, true, true, true, true, true, true };
	makeBox(3, p, v, upv,tabWidthb, tabHeightb, sidesb, false, false, 5,5,0);
#else
	p1.set(length, 0, 0);
	makeRectSimpleGrill(p1, vx, width, height, false);
#endif
}

void GLEVentilators::makeCV3(double diam1, double diam2, double length1, double length2, double length3, int n)
{
	FdPoint3d p1(0, 0, 0), p2(length1, 0, 0), p3;
	FdPoint3d centerPoints1[3] = { p1,p2,p2};
	double diams1[3] = { diam1, diam1, diam2 };
	makeStraightTube(centerPoints1, diams1, n, 2, true);

	p1.set(length1,                     0, 0);
	p2.set(length1 + length2,           0, 0);
	p3.set(length1 + length2 + length3, 0, 0);
	FdPoint3d centerPoints2[3] = { p1,p2,p3};
	double diams2[3] = { diam2, diam2, diam1 };
	makeStraightTube(centerPoints2, diams2, n, 2, false);

	p1.set(0,0,0);
	addCircularConnector(p1);

	p1.set(length1, 0, 0);
	drawAsThinArc(p1, diam1 / 2);
}

void GLEVentilators::makeRV1(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2, 0, 0),
	          p2( l / 2, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);

	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	// add approriate symbol to all four sides
	double symbolSize1, symbolSize2;
	if( l < a )
		symbolSize1 = l / 1.5;
	else
		symbolSize1 = a / 1.5;
	if( l < b )
		symbolSize2 = l / 1.5;
	else
		symbolSize2 = b / 1.5;

	p1.set(0, 0, b / 2);
	makeCircleWithTriangle(p1, vz, vy, symbolSize1);

	p1.set(0, a / 2,  0);
	makeCircleWithTriangle(p1, vy, -vz, symbolSize2);

	p1.set(0,  0, -b / 2);
	makeCircleWithTriangle(p1, -vz, -vy, symbolSize1);

	p1.set(0, -a / 2, 0);
	makeCircleWithTriangle(p1, -vy, vz, symbolSize2);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1(-l / 2.0, 0, 0),
		          p2( l / 2.0, 0, 0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabWidth[2] = { b + 2 * size, b + 2 * size };
		double tabHeight[2] = { a + 2 * size, a + 2 * size };
		bool sides[4] = { true, true, true, true };
		makeBox(1, centralPoints, v, upv, tabWidth, tabHeight, sides, false, false, (size > flange_1) ? 0 : 5, (size > flange_2) ? 0 : 5, (flange_1 > flange_2) ? (flange_2 - size) : (flange_1 - size));
	}
}





// CRAF -> command from library GenCRAF
void GLEVentilators::makeCRAF(double d1, double d2, double d0, double h1, double h2, double l1, double l2, double l3, double l4, double d10, double r0, int n)
{
	// getting options
	char *outlet, *side;
	get_val("outlet", outlet);
	get_val("side", side);

	// condition strings
	char rSide[] = "right";
	char lSide[] = "left";

	char vtOutlet[] = "vertical_top";
	char vbOutlet[] = "vertical_bottom";
	char htOutlet[] = "horizontal_top";
	char hbOutlet[] = "horizontal_bottom";

	// start points
	FdPoint3d s1(0, 0, 0);
	// side tube start points
	FdPoint3d s2(0, 0, 0);  // centerpoint of second (biger) donut
	FdPoint3d s3(0, 0, 0);  // startpoint of side straight tube
	FdPoint3d s4(0, 0, 0);  // endpoint of side straight tube
	// outlet start points
	FdPoint3d p1(0, 0, 0);  // start point of engine
	FdPoint3d p2(0, 0, 0);  // end point of engine
	FdPoint3d p3(0, 0, 0);  // start point of outlet
	FdPoint3d p4(0, 0, 0);  // end point of outlet


	// additional parameters
	FdVector3d sideTVector;
	FdVector3d normSideTVector;
	double donut1Rad = l2-d2/2;
	double donut2Rad = r0-d2/2;
	double donut2SkAngle = 90;
	int segQuant = 30;

	makeDonutSection(s1, vx, vz, donut1Rad, d2, 360, n, segQuant);  // main donut

// outlet conditions
  // outlet: "vertical_top"
	if( strcmp(outlet, vtOutlet) == 0 ) {
		sideTVector = -vz;
		normSideTVector = vz;
		donut2SkAngle = 90;
		s2.set(0, 0, r0-l2);
		s3.set(0, r0-d2/2, r0-l2);	s4.set(0, r0-d2/2, (h1-l2));         // side staright tube
	}
  // outlet: "vertical_bottom"
	else if( strcmp(outlet, vbOutlet) == 0 ) {
		sideTVector = vy;
		normSideTVector = vz;
		donut2SkAngle = 90;
		s2.set(0, 0, -(r0-l2));
		s3.set(0, r0-d2/2, -(r0-l2));	s4.set(0, r0-d2/2, -(h1-l2));    // side staright tube
	}
  // outlet: "horizontal_top"
	else if( strcmp(outlet, htOutlet) == 0 ) {
		sideTVector = vz;
		normSideTVector = vy;
		donut2SkAngle = 90;
		s2.set(0, r0-l2, 0);
		s3.set(0, r0-l2, r0-d2/2);	s4.set(0, (h1-l2), r0-d2/2);         // side staright tube
	}
  // outlet: "horizontal_bottom"
	else{
		sideTVector = -vy;
		normSideTVector = vy;
		donut2SkAngle = 90;
		s2.set(0, r0-l2, 0);
		s3.set(0, r0-l2, -(r0-d2/2));	s4.set(0, (h1-l2), -(r0-d2/2));  // side staright tube
	}

	// side conditions
	if( strcmp(side, rSide) == 0 ) {  // side: "right"
		p1.set(-d2/2, 0, 0);	p2.set(-d2/2-l3, 0, 0);  // engine
		p3.set(d2/2, 0, 0);		p4.set(d2/2+l4, 0, 0);   // outlet
	}
	else{
		p1.set(d2/2, 0, 0);		p2.set(d2/2+l3, 0, 0);   // engine
		p3.set(-d2/2, 0, 0);	p4.set(-d2/2-l4, 0, 0);  // outlet
	}

	FdPoint3d tubePoint[2] = {s3, s4};

	// bent part of side tube
	makeDonutSection(s2, vx, sideTVector, donut2Rad, d2, donut2SkAngle, n, segQuant);  // main donut

	// straight part of side tube
	makeVerySimpleTube(tubePoint, d2, n);

	// make donut caps
	makeFlatDisc(p1, vx, 2*donut1Rad, n);
	makeFlatDisc(p3, vx, 2*donut1Rad, n);

	// make engine
	FdPoint3d engCPoints[3] = {p1, p2, p2};
	double engDiams[3] = {d0, d0, 0};

	makeStraightTube(engCPoints, engDiams, n, 2);

	// make input tube
	FdPoint3d inCPoints[2] = {p3, p4};
	makeVerySimpleTube(inCPoints, d1, n);

	// make connectors
	addCircularConnector(s4);
	addCircularConnector(p4);

	// removing extra lines
	// addEraseCircle(s3, normSideTVector, d2);  // circle on connection side tube and side part of donut

	// addEraseCircle(p1, vx, 2*donut1Rad);      // circle on connection engine and main donut
	// addEraseCircle(p3, vx, 2*donut1Rad);      // circle on connection outlet and main donut
}

// RRAF -> command from library GenRRAF
void GLEVentilators::makeRRAF(double a, double b, double d1, double c, double d, double d0, double h1, double h2, double l1, double l2, double l3, double l4,
                              double d10, double r0, int n)
{
	// getting flange sizes
	double fls_up, fls_down, fls_left, fls_right, fls_front, fls_back;
	double fls_left1, fls_right1;
	// double flw_up, flw_down, flw_left, flw_right, flw_front, flw_back;
	// double flw_left1, flw_right1;

	get_val("__fls_up", fls_up); get_val("__fls_down", fls_down);
	get_val("__fls_left", fls_left); get_val("__fls_right", fls_right);
	get_val("__fls_front", fls_front); get_val("__fls_back", fls_back);
	get_val("__fls_left1", fls_left1); get_val("__fls_right1", fls_right1);

	// getting additional options
	char *outlet, *side, *conn;
	get_val("outlet", outlet);
	get_val("side", side);
	get_val("conn", conn);

	// condition strings
	char rSide[] = "right";
	char lSide[] = "left";

	char vtOutlet[] = "vertical_top";
	char vbOutlet[] = "vertical_bottom";
	char htOutlet[] = "horizontal_top";
	char hbOutlet[] = "horizontal_bottom";

	char cirConn[] = "circ";
	char recConn[] = "rect";

	// additional variables
	// points for main part of ventilator
	FdPoint3d p1(0, 0, 0);
	FdPoint3d p2(0, 0, 0), p3(0, 0, 0);  // straight box
	FdPoint3d p4(0, 0, 0), p5(0, 0, 0);  // cover between box and main tube

	// points for engine and input
	FdPoint3d s1(0, 0, 0), s2(0, 0, 0);  // main vent. tube
	FdPoint3d s3(0, 0, 0), s4(0, 0, 0);  // engine
	FdPoint3d s5(0, 0, 0), s6(0, 0, 0);  // engine

	// common vectors
	FdVector3d normSideVector;
	FdVector3d upSideVector;
	FdVector3d normInVector;

	double alfa = 90;
	double sideRad = r0-d;

	// common variables
	double ventDiams[4] = {0, 2*l2+0.01, 2*l2+0.01, 0};
	double inDiams[3] = {0, d1, d1};

	double sideWidth[2] = {d, d};
	double sideHeight[2] = {c, c};
	double coverWidth[2] = {d, d};
	double coverHeight[2] = {c, c};
	double inWFlange = 0;
	double inHFlange = 0;
	double sideWFlange = 0;
	double sideHFlange = 0;

	bool outSides[4] = { true, true, true, true };


// conditions (side, outlet, conn)
  // outlet placing condition
	// vertical_top
	if( strcmp(outlet, vtOutlet) == 0 ) {
		normSideVector = vy;
		upSideVector = -vx;

		p1.set(0, 0, -(2*l2-d)/2);
		p2.set(0, r0-d/2, (r0-2*l2/2));	p3.set(0, r0-d/2, (h1-2*l2/2));  // side staright tube
		p4.set(0, 0, (2*l2-d)/2);	p5.set(0, r0-d, (2*l2-d)/2);         // cover

		// output connector
		addRectangularConnector(p3, vz, vy, a, b);
	}
	// vertical_bottom
	else if( strcmp(outlet, vbOutlet) == 0 ) {
		normSideVector = vy;
		upSideVector = vx;

		p1.set(0, 0, (2*l2-d)/2);
		p2.set(0, r0-d/2, -(r0-2*l2/2));	p3.set(0, r0-d/2, -(h1-2*l2/2));  // side staright tube
		p4.set(0, 0, -(2*l2-d)/2);	p5.set(0, r0-d, -(2*l2-d)/2);             // cover

		// output connector
		addRectangularConnector(p3, -vz, vy, a, b);
	}
	// horizontal_top
	else if( strcmp(outlet, htOutlet) == 0 ) {
		normSideVector = vz;
		upSideVector = vx;

		p1.set(0, -(2*l2-d)/2, 0);
		p2.set(0, (r0-2*l2/2), r0-d/2);	p3.set(0, (h1-2*l2/2), r0-d/2);  // side staright tube
		p4.set(0, (2*l2-d)/2, 0);	p5.set(0, (2*l2-d)/2, r0-d);         // cover

		// output connector
		addRectangularConnector(p3, vy, vx, a, b);
	}
	// horizontal_bottom
	else {
		normSideVector = -vz;
		upSideVector = -vx;

		p1.set(0, -(2*l2-d)/2, 0);
		p2.set(0, (r0-2*l2/2), -(r0-d/2));	p3.set(0, (h1-2*l2/2), -(r0-d/2));  // side staright tube
		p4.set(0, (2*l2-d)/2, 0);	p5.set(0, (2*l2-d)/2, -(r0-d));             // cover

		// output connector
		addRectangularConnector(p3, vy, -vx, a, b);
	}

  // side condition
	if( strcmp(side, rSide) == 0 ) {
		normInVector = -vx;

		s1.set(-(c/2)-0.01, 0, 0); s2.set((c/2)+0.01, 0, 0);  // for main vent. tube
		s3.set(-(c/2)-0.01, 0, 0); s4.set(-(c/2+l3), 0, 0);   // for engine
		s5.set((c/2)-+0.01, 0, 0); s6.set((c/2+l4), 0, 0);    // input
	} else {
		normInVector = vx;

		s1.set(-(c/2)-0.01, 0, 0); s2.set((c/2)+0.01, 0, 0);  // for main vent. tube
		s3.set((c/2)+0.01, 0, 0); s4.set((c/2+l3), 0, 0);     // for engine
		s5.set(-(c/2)-0.01, 0, 0); s6.set(-(c/2+l4), 0, 0);   // input
	}

  // input connector type condition
	if (strcmp(conn, cirConn) == 0){
		// input tube points
		FdPoint3d inCPoints[4] = {s5, s5, s6};

		makeStraightTube(inCPoints, inDiams, n, 2);

		// input connector
		addCircularConnector(s6);
	} else {
		// input box points
		FdPoint3d inCPoints[4] = {s5, s5, s6};

		double inWidth[3] = {0, a, a};
		double inHeight[3] = {0, b, b};
		makeBox(2, inCPoints, inWidth, inHeight, false);

		// input connector
		addRectangularConnector(inCPoints[3], normInVector, vy, a, b);
	}

	// main vent. tube + side tube (outlet) + cover (between them)
	FdPoint3d outCPoint[2] = {p2, p3};
	FdPoint3d covCPoint[2] = {p4, p5};
	FdPoint3d ventCPoints[4] = {s1, s1, s2, s2};

	makeStraightTube(ventCPoints, ventDiams, n, 3);

	makeBend2(p1, normSideVector, upSideVector, outSides, true, alfa, alfa, d, c, d, n, sideRad, true, false);
	makeBox(1, outCPoint, sideWidth, sideHeight, false);
	makeBox(1, covCPoint, coverWidth, coverHeight, false);

	// engine tube
	FdPoint3d engCPoints[4] = {s3, s3, s4, s4};
	double engDiams[4] = {0, d0, d0, 0};

	makeStraightTube(engCPoints, engDiams, n, 3);

}
///////////////////////////////////////////////END OF GENERAL VENTILATORS FUNCTIONS///////////////////////////////////

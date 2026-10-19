#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define GLEFireSecurity SmkGenBlockCreator

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

#define fo 20
#define CONNECTOR_WIDTH 30


////////////////////////////////////////////BEGINNING OF GENERAL FIRE SECURITY FUNCTIONS///////////////////////////////////
void GLEFireSecurity :: makeCFD1(double L, double D, double tubeN, double W, double disc_t, double discN, double H, double e, double f, double A, double B)
{
	// make main tube
	FdPoint3d p1, p2;
	p1.set(-L / 2, 0, 0);
	p2.set( L / 2, 0, 0);
	FdPoint3d centers[2] = { p1, p2 };
	makeVerySimpleTube(centers, D, tubeN);

	// make disc
	p1.set( L / 2 - W, 0, 0);
	makeDisc(p1, vy, D - 2 * disc_t, disc_t, discN, true);

	p1.set(-L / 2, 0, 0);
	p2.set( L / 2, 0, 0);
	addCircularConnector(p1);
	addCircularConnector(p2);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1, p2;
		p1.set(-L / 2, 0, 0);
		p2.set( L / 2, 0, 0);
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, D + 2 * size, tubeN);

		makeFlatRing(p1, vx, D, D + 2 * size, tubeN);
		makeFlatRing(p2, vx, D, D + 2 * size, tubeN);

		setPrimitiveMode(FLM3Geo::pmNormal);

		// make box
		p1.set(-L / 2 + e, -H / 2, (D + 2 * size) / 2 + B / 2);
		p2.set(-L / 2 + e,  H / 2, (D + 2 * size) / 2 + B / 2);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d vectors[2] = { vy, vy };
		FdVector3d upVectors[2] = { vx, vx };
		double tabWidth[2] = { B, B };
		double tabHeight[2] = { A, A };
		bool sides[4] = { true, true, true, true };
		bool con[2] = { false, false };
		makeBox(1, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, true, true, 5, 5, CONNECTOR_WIDTH);
	}
	else
	{
		// make box
		p1.set(-L / 2 + e, -H / 2, D / 2 + B / 2);
		p2.set(-L / 2 + e,  H / 2, D / 2 + B / 2);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d vectors[2] = { vy, vy };
		FdVector3d upVectors[2] = { vx, vx };
		double tabWidth[2] = { B, B };
		double tabHeight[2] = { A, A };
		bool sides[4] = { true, true, true, true };
		bool con[2] = { false, false };
		makeBox(1, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, true, true, 5, 5, CONNECTOR_WIDTH);
	}
}

void GLEFireSecurity :: makeDRSD(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2.0, 0, 0),
	          p2( l / 2.0, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	// add approriate symbol to all four sides
	bool sides[4] = { true, true, true, true };

	p1.set(0, 0, b / 2);
	makeBowTie(p1, vz, vy, a, l, 15.875);
	makeSymbolicRectangle(p1, vz, vy, a - 40, 100, sides);

	p1.set(0, a / 2, 0);
	makeBowTie(p1, vy, -vz, b, l, 15.875);
	makeSymbolicRectangle(p1, vy, -vz, b - 40, 100, sides);

	p1.set(0, 0, -b / 2);
	makeBowTie(p1, -vz, -vy, a, l, 15.875);
	makeSymbolicRectangle(p1, -vz, -vy, a - 40, 100, sides);

	p1.set(0, -a / 2, 0);
	makeBowTie(p1, -vy, vz, b, l, 15.875);
	makeSymbolicRectangle(p1, -vy, vz, b - 40, 100, sides);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1(-l / 2.0, 0,0),
		          p2( l / 2.0, 0,0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabWidth[2] = { b + 2 * size, b + 2 * size };
		double tabHeight[2] = { a + 2 * size, a + 2 * size };
		bool sides[4] = { true, true, true, true };
		makeBox(1, centralPoints, v, upv, tabWidth, tabHeight, sides, false, false, (size > flange_1) ? 0 : 5, (size > flange_2) ? 0 : 5, (flange_1 > flange_2) ? (flange_2 - size) : (flange_1 - size));
	}
}

void GLEFireSecurity :: makeDWSD(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2.0, 0, 0),
	          p2( l / 2.0, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	// add approriate symbol to all four sides
	bool sides[4] = { true, false, true, true };
	p1.set(0, 0, b / 2);
	makeBowTie(p1, vz, vy, a, l, 15.875);

	p1.x = -l / 2 + a / 4;
	makeSymbolicRectangle(p1, vz, vy, a - 40, a / 2, sides);

	p1.set(0, a / 2, 0);
	makeBowTie(p1, vy, -vz, b, l, 15.875);

	p1.set(0, 0, -b / 2);
	makeBowTie(p1, -vz, -vy, a, l, 15.875);

	p1.x = -l / 2 + a / 4;
	makeSymbolicRectangle(p1, -vz, -vy, a - 40, a / 2, sides);

	p1.set(0, -a / 2, 0);
	makeBowTie(p1, -vy, vz, b, l, 15.875);

	sides[0] = false;
	p1.set(-l / 2 + b / 4, a / 2, -b / 2 + 25);
	makeSymbolicRectangle(p1, vy, -vz, 50, b / 2, sides);

	p1.z = b / 2 - 25;
	makeSymbolicRectangle(p1, -vy, vz, 50, b / 2, sides);

	p1.x = -l / 2;  p1.z = -b / 2;
	makeSymbolicArc(p1, vy, vz, b / 2, 90);

	p1.z = b / 2;
	makeSymbolicArc(p1, -vy, -vz, b / 2, 90);

	sides[0] = false;
	p1.set(-l / 2 + b / 4, -a / 2, -b / 2 + 25);
	makeSymbolicRectangle(p1, vy, -vz, 50, b / 2, sides);

	p1.z = b / 2 - 25;
	makeSymbolicRectangle(p1, -vy, vz, 50, b / 2, sides);

	p1.x = -l / 2;  p1.z = -b / 2;
	makeSymbolicArc(p1, vy, vz, b / 2, 90);

	p1.z = b / 2;
	makeSymbolicArc(p1, -vy, -vz, b / 2, 90);

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

void GLEFireSecurity :: makeOWSD(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1, p2;
	p1.set(-l / 2.0, 0, 0);
	p2.set( l / 2.0, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	// add approriate symbol to all four sides
	bool sides[4] = { true, false, true, true };
	p1.set(0, 0, b / 2);
	makeBowTie(p1, vz, vy, a, l, 15.875);

	p1.x = -l / 2 + a / 4;
	makeSymbolicRectangle(p1, vz, vy, a - 40, a / 2, sides);

	p1.set(0, a / 2, 0);
	makeBowTie(p1, vy, -vz, b, l, 15.875);

	p1.set(0, 0, -b / 2);
	makeBowTie(p1, -vz, -vy, a, l, 15.875);

	p1.x = -l / 2 + a / 4;
	makeSymbolicRectangle(p1, -vz, -vy, a - 40, a / 2, sides);

	p1.set(0, -a / 2, 0);
	makeBowTie(p1, -vy, vz, b, l, 15.875);

	sides[0] = false;
	p1.set(-l / 2 + b / 2, a / 2, b / 2 - 25);
	makeSymbolicRectangle(p1, -vy, vz, 50, b, sides);

	p1.x = -l / 2;  p1.z = b / 2;
	makeSymbolicArc(p1, -vy, -vz, b, 90);

	p1.set(-l / 2 + b / 2, -a / 2, b / 2 - 25);
	makeSymbolicRectangle(p1, -vy,vz, 50, b, sides);

	p1.x = -l / 2;  p1.z = b / 2;
	makeSymbolicArc(p1, -vy, -vz, b, 90);

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

void GLEFireSecurity :: makeRFD1(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2.0, 0, 0),
	          p2( l / 2.0, 0, 0);
    FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	// add approriate symbol to all four sides
	bool sides[4] = { true, true, true, true };
	p1.set(0, 0, b / 2);
	makeHourGlass(p1, vz, vy, a, l, 15.875);
	makeSymbolicRectangle(p1, vz, vy, a - 40, 100, sides);

	p1.set(0, a / 2, 0);
	makeHourGlass(p1, vy, -vz, b, l, 15.875);
	makeSymbolicRectangle(p1, vy, -vz, b - 40, 100, sides);

	p1.set(0, 0, -b / 2);
	makeHourGlass(p1, -vz, -vy, a, l, 15.875);
	makeSymbolicRectangle(p1, -vz, -vy, a - 40, 100, sides);

	p1.set(0, -a / 2, 0);
	makeHourGlass(p1, -vy, vz, b, l, 15.875);
	makeSymbolicRectangle(p1, -vy, vz, b - 40, 100, sides);

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

void GLEFireSecurity :: makeSSD(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2.0, 0, 0),
	          p2( l / 2.0, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	// add approriate symbol to all four sides
	p1.set(0, 0, b / 2);
	makeDampers(p1, vz, vy, a, 5);
	makeBowTie(p1, vz, vy, a, l, 15.875);

	p1.set(0, a / 2, 0);
	makeDampers(p1, vy, -vz, b, 5);
	makeBowTie(p1, vy, -vz, b, l, 15.875);

	p1.set(0, 0, -b / 2);
	makeDampers(p1, -vz, -vy, a, 5);
	makeBowTie(p1, -vz, -vy, a, l, 15.875);

	p1.set(0, -a / 2, 0);
	makeDampers(p1, -vy, vz, b, 5);
	makeBowTie(p1, -vy, vz, b, l, 15.875);

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

void GLEFireSecurity :: makeTSD(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2.0, 0, 0),
	          p2( l / 2.0, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	// add approriate symbol to all four sides
	p1.set(0, 0, b / 2);
	makeBowTie(p1, vz, vy, a, l, 15.875);
	makeZigZag(p1, vz, vy, a, a * 0.0875, 4);

	p1.set(0, a / 2, 0);
	makeBowTie(p1, vy, -vz, b, l, 15.875);
	makeZigZag(p1, vy, -vz, b, b * 0.0875, 4);

	p1.set(0, 0, -b / 2);
	makeBowTie(p1, -vz, -vy, a, l, 15.875);
	makeZigZag(p1, -vz, -vy, a, a * 0.0875, 4);

	p1.set(0, -a / 2, 0);
	makeBowTie(p1, -vy, vz, b, l, 15.875);
	makeZigZag(p1, -vy, vz, b, b * 0.0875, 4);

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

void GLEFireSecurity :: makeFV1(double D1, double D2, double D3, double h, double n)
{
	FdPoint3d p1(0,0,0), p2;
	makeGrillType2(p1, vx, D1, D2, D3, n, h, 10, true);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		p1.set(0, 0, 0);
		p2.set(h, 0, 0);
		FdPoint3d p[2] = { p1, p2 };
		makeSimpleTube(p, D1 + 2 * size, D1 + 2 * size, n);

		makeFlatRing(p1, vx, D1 + 2 * size, D1, n);

		if( D1 + 2 * size > D3 )
			makeFlatRing(p2, vx, D1 + 2 * size, D3, n);
	}

	// Note: Hlr line info handled by primitive.
}
//////////////////////////////////////////////END OF GENERAL FIRE SECURITY FUNCTIONS///////////////////////////////////////

#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

#define GLERectangular SmkGenBlockCreator


#define _USE_MATH_DEFINES


// TubularPrimitives tubePrimsR;
// RectangularPrimitives rectPrimsR;

#define ARRAY_LENGTH 1000
//Copy - Paste from 2D code
// Panol library variables used
// double vfh = 30;
// General library variables
extern double fo; // = 30;		// Flange offset : el, Used in: CR1
extern double fs; // = 45;		// Flange offset : eh, Used in: BO
double g_vlh = 45;
double g_vfh = 35;
double g_eb = 50;
double g_ep = 30;
double BSFlange = 20; //BS, BO,K,TR6 flange

//needed for my grills
double icr = 0.01; //-inner circle radius
double HOW_COMPLEX = 10;


/////////////////////////////////////BEGINNING OF GENERAL RECTANGULAR ELEMENT FUNCTIONS///////////////////////////////////
void GLERectangular :: makeBA(double alfa, double a, double b, double d, double e, double f, double r, double n, double flange_1, double flange_2)
{
	//--- Some initial reference calculations to make things easier.  Variables
	//--- 'x' & 'y' are the coordinates of B connector's center on the XY plane.
	double rang = M_PI * alfa / 180.0,
		   x    = -(r - r * cos(rang)) / 2.0,
		   y    = -((d + r) * sin(rang)) / 2.0 - f;


	//___________________ADD LINE INFO FOR THE B CONNECTOR_________________________
	//--- Add connector, thin, and center lines for the B connector.  This is the
	//--- easy one because it always remains stationary relative to the angle.
	FdPoint3d bStart(x, y + f, 0), bBase(x, y + BSFlange, 0), bConn(x, y, 0);
	addRectangularConnector(bConn, vy, vz, a + 2 * flange_1, b + 2 * flange_1);
	addSymbolicFlangeRect(bBase, vy, vz, a, b);
	addCenterLine(bConn, bStart);
	//_____________________________________________________________________________


	//____________________ADD LINE INFO FOR D CONNECTOR____________________________
	//--- Add connector, thin and center line for the "d" connector.  This is the
	//--- hard one because its position and orientation change depending on rang.
	//-- First find the 3 points and normal of the D connector.
	FdPoint3d axisOfRot(x+ b/2.0 + r, y + f, 0 );  // Were the bend a donut section, this would be the center.
	FdVector3d dVec = -vx;  dVec.rotateBy(rang, -vz);  // The direction in which length "d" applies.
	FdVector3d dNormal = dVec.crossProduct(vz);
	FdPoint3d dStart = axisOfRot + dVec * (r + d/2), dBase = dStart + dNormal * (e - BSFlange), dConn = dBase + dNormal * BSFlange;

	//-- Now add the line definitions according to the geo structures.
	addRectangularConnector(dConn, dNormal, vz, a + 2 * flange_2, d + 2 * flange_2);
	addSymbolicFlangeRect(dBase, dNormal, vz, a, d);
	addCenterLine(dStart, dConn);
	//_____________________________________________________________________________


	//__________________________ADD ERASE LINE INFO________________________________
	//-- Erase the lines where the B connector meets the bend.
	bool eraseSides1[4] = {true, false, true, false}, eraseSides2[4] = {false, true, false, true};
	addEraseRect(bStart, vy, vz, a, b, eraseSides1);
	addEraseRect(bStart, vy, vz, a, b, vx, eraseSides2); // Lines won't be erased if view is perpendicular to the x-axis.

	//-- Erase the lines where the D connector meets the bend.
	addEraseRect(dStart, dNormal, vz, a, d, eraseSides1);
	addEraseRect(dStart, dNormal, vz, a, d, dVec, eraseSides2); // Lines won't be erased if view is perpendicular to dVec.
	
	//-- If d and b differ, a tricky line on the outside of the bend itself needs to be erased.
	double dCenterLength;  // Needed for bend center line calculation if b > d.
	if( d != b )
	{
		FdPoint3d line1Beg = bStart - vx * b / 2, line1End = line1Beg + vy * b * d,
				  line2Beg = dStart + dVec * d / 2, line2End = line2Beg - dNormal * b * d;
		FdPoint3d outerPeak;
		lineSegToLineSegInt(line1Beg, line1End, line2Beg, line2End, outerPeak);
		FdVector3d peakVector = (line1Beg - outerPeak).normal() + (line2Beg - outerPeak).normal();
		FdPoint3d outerPeakPartner = outerPeak + peakVector * b * d;

		if( d > b )
		{
			FdPoint3d outerArcCenter, dPtBeg = dStart + dVec * d, dPtEnd = dStart - dVec * d;
			lineSegToLineSegInt(dPtBeg, dPtEnd, outerPeak, outerPeakPartner, outerArcCenter);
			FdPoint3d beg = line1Beg, end = line1Beg;
			beg += vz * a / 2;  end -= vz * a / 2;
			beg.y = outerArcCenter.y;  end.y = outerArcCenter.y;
			addEraseLine(beg, end, vx);  // Line won't be erased if view is perpendicular to the x-axis.
		}
		else if( b > d )
		{
			FdPoint3d outerArcCenter, bPtBeg = bStart + vx * b, bPtEnd = bStart - vx * b;
			lineSegToLineSegInt(bPtBeg, bPtEnd, outerPeak, outerPeakPartner, outerArcCenter);
			FdPoint3d eraseLinePoint;
			lineSegToLineSegInt(line2Beg, line2End, outerArcCenter, outerArcCenter + dVec * d * 2, eraseLinePoint);
			dCenterLength = (eraseLinePoint - line2Beg).length() / 2;
			FdPoint3d beg = eraseLinePoint, end = eraseLinePoint;
			beg += vz * a / 2;  end -= vz * a / 2;
			addEraseLine(beg, end, dVec);  // Line won't be erased if view is perpendicular to dVec.
		}
	}
	//_____________________________________________________________________________

	//_______________________ADD CENTER LINE FOR THE BEND__________________________
	//-- Add the center line for the bend.  If b == d, this is one simple arc. Otherwise
	//-- it is made from a line and an arc and is a little difficult to construct.
	if( d == b )
		addCenterArc(axisOfRot, -vz, -vx, b / 2 + r, 0, rang);
	else
	{
		FdPoint3d line1Beg = bStart, line1End = line1Beg + vy * b * d,
				  line2Beg = dStart, line2End = line2Beg - dNormal * b * d;
		FdPoint3d centerPeak;
		lineSegToLineSegInt(line1Beg, line1End, line2Beg, line2End, centerPeak);
		FdVector3d peakVector = (line1Beg - centerPeak).normal() + (line2Beg - centerPeak).normal();
		FdPoint3d centerPeakPartner = centerPeak + peakVector * b * d;

		if( d > b )
		{
			FdPoint3d centerArcCenter, dPtBeg = dStart + dVec * d, dPtEnd = dStart - dVec * d;
			lineSegToLineSegInt(dPtBeg, dPtEnd, centerPeak, centerPeakPartner, centerArcCenter);
			FdPoint3d clPoint = bStart;  clPoint.y = centerArcCenter.y;
			addCenterArc(centerArcCenter, -vz, -vx, (centerArcCenter - dStart).length(), 0, rang);
			addCenterLine(bStart, clPoint);
		}
		else if( b > d )
		{
			FdPoint3d centerArcCenter, bPtBeg = bStart + vx * b, bPtEnd = bStart - vx * b;
			lineSegToLineSegInt(bPtBeg, bPtEnd, centerPeak, centerPeakPartner, centerArcCenter);
			FdPoint3d clPoint = dStart - dNormal * dCenterLength;
			addCenterArc(centerArcCenter, -vz, -vx, (centerArcCenter - bStart).length(), 0, rang);
			addCenterLine(dStart, clPoint);
		}
	}
	//_____________________________________________________________________________
	

	/**********************************GEOMETRY*************************************/

	//_____________________________MAKE THE BEND___________________________________
	bool sides1[4] = { true, false, true, false };
	makeBend2(bStart, vy, vz, sides1, true, alfa, alfa, b, a, d, n, r, true, false);
	
	bool sides2[4] = { false, true, false, true };
	makeBend2(bStart, vy, vz, sides2, true, alfa, alfa, b, a, d, n, r, true, false);
	//_____________________________________________________________________________

	//__________________________MAKE THE B CONNECTOR_______________________________
	FdVector3d bNormals[3] = { -vy, -vy, -vy }, ups[3] = { vz, vz, vz };
	double bWidths[3]  = { b, b, b }, heights[3] = { a, a, a };
	bool sides[8] = { true, true, true, true, true, true, true, true };
	FdPoint3d bCenters[2] = { bStart, bConn };
	makeBox(1, bCenters, bNormals, ups, bWidths, heights, sides, false, false, 5, 0, flange_1);
	//_____________________________________________________________________________


	//__________________________MAKE THE D CONNECTOR_______________________________

	FdVector3d dNormals[3] = { dNormal, dNormal, dNormal };
	double dWidths[3]  = { d, d, d };
	FdPoint3d dCenters[3] = {dStart, dConn};
	makeBox(1, dCenters, dNormals, ups, dWidths, heights, sides, false, false, 5, 0, flange_2);
	//_____________________________________________________________________________


	/****************************Copy/create Insulation vairables*******************/
	double copyb = b, copyd = d, copyr = r, copya = a;
	double size;

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		if( size >= r )
			{  size = r - 0.1;  };

		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		b += 2 * size;
		d += 2 * size;
		r -= size;
		a += 2 * size; 
	
		
		//__________________________ADD ERASE LINE INFO________________________________
		//-- Erase the lines where the B connector meets the bend.
		bool eraseSides1[4] = {true, true, true, true};
		addEraseRect(bStart, vy, vz, a, b, eraseSides1);
		//addEraseRect(bStart, vy, vz, a, b, vx, eraseSides2); // Lines won't be erased if view is perpendicular to the x-axis.

		//-- Erase the lines where the D connector meets the bend.
		addEraseRect(dStart, dNormal, vz, a, d, eraseSides1);
		//addEraseRect(dStart, dNormal, vz, a, d, dVec, eraseSides2); // Lines won't be erased if view is perpendicular to dVec.
		
		//-- If d and b differ, a tricky line on the outside of the bend itself needs to be erased.
		double dCenterLength;  // Needed for bend center line calculation if b > d.
		if( d != b )
		{
			FdPoint3d line1Beg = bStart - vx * b / 2, line1End = line1Beg + vy * b * d,
					line2Beg = dStart + dVec * d / 2, line2End = line2Beg - dNormal * b * d;
			FdPoint3d outerPeak;
			lineSegToLineSegInt(line1Beg, line1End, line2Beg, line2End, outerPeak);
			FdVector3d peakVector = (line1Beg - outerPeak).normal() + (line2Beg - outerPeak).normal();
			FdPoint3d outerPeakPartner = outerPeak + peakVector * b * d;

			if( d > b )
			{
				FdPoint3d outerArcCenter, dPtBeg = dStart + dVec * d, dPtEnd = dStart - dVec * d;
				lineSegToLineSegInt(dPtBeg, dPtEnd, outerPeak, outerPeakPartner, outerArcCenter);
				FdPoint3d beg = line1Beg, end = line1Beg;
				beg += vz * a / 2;  end -= vz * a / 2;
				beg.y = outerArcCenter.y;  end.y = outerArcCenter.y;
				addEraseLine(beg, end, vx);  // Line won't be erased if view is perpendicular to the x-axis.
			}
			else if( b > d )
			{
				FdPoint3d outerArcCenter, bPtBeg = bStart + vx * b, bPtEnd = bStart - vx * b;
				lineSegToLineSegInt(bPtBeg, bPtEnd, outerPeak, outerPeakPartner, outerArcCenter);
				FdPoint3d eraseLinePoint;
				lineSegToLineSegInt(line2Beg, line2End, outerArcCenter, outerArcCenter + dVec * d * 2, eraseLinePoint);
				dCenterLength = (eraseLinePoint - line2Beg).length() / 2;
				FdPoint3d beg = eraseLinePoint, end = eraseLinePoint;
				beg += vz * a / 2;  end -= vz * a / 2;
				addEraseLine(beg, end, dVec);  // Line won't be erased if view is perpendicular to dVec.
			}
		}

			//___________________ADD LINE INFO FOR THE B CONNECTOR_________________________
			//--- Add connector, thin, and center lines for the B connector.  This is the
			//--- easy one because it always remains stationary relative to the angle.
			FdPoint3d bStart(x, y + f, 0), bBase(x, y + BSFlange, 0), bConn(x, y, 0);
			addEraseRect(bBase, vy, vz, a, b,eraseSides1);
			//_____________________________________________________________________________


			//____________________ADD LINE INFO FOR D CONNECTOR____________________________
			//--- Add connector, thin and center line for the "d" connector.  This is the
			//--- hard one because its position and orientation change depending on rang.
			//-- First find the 3 points and normal of the D connector.
			FdPoint3d axisOfRot(x+ b/2.0 + r, y + f, 0 );  // Were the bend a donut section, this would be the center.
			FdVector3d dVec = -vx;  dVec.rotateBy(rang, -vz);  // The direction in which length "d" applies.
			FdVector3d dNormal = dVec.crossProduct(vz);
			FdPoint3d dStart = axisOfRot + dVec * (r + d/2), dBase = dStart + dNormal * (e - BSFlange), dConn = dBase + dNormal * BSFlange;

			//-- Now add the line definitions according to the geo structures.
			addEraseRect(dBase, dNormal, vz, a, d, eraseSides1);
			//_____________________________________________________________________________


		//_____________________________________________________________________________



		//_____________________________MAKE THE BEND___________________________________
		bool sides1[4] = { true, false, true, false };
		makeBend2(bStart, vy, vz, sides1, true, alfa, alfa, b, a, d, n, r, true, false);
		
		bool sides2[4] = { false, true, false, true };
		makeBend2(bStart, vy, vz, sides2, true, alfa, alfa, b, a, d, n, r, true, false);
		//_____________________________________________________________________________

		//__________________________MAKE THE B CONNECTOR_______________________________
		FdVector3d bNormals[3] = {-vy, -vy, -vy}, ups[3] = {vz, vz, vz};
		double bWidths[3]  = { b, b, b }, heights[3] = { a, a, a };
		bool sides[8] = { true, true, true, true, true, true, true, true };
		FdPoint3d bCenters[2] = {bStart, bConn};
		makeBox(1, bCenters, bNormals, ups, bWidths, heights, sides, false, false, 5, (size > flange_1) ? 0 : 5, flange_1 - size);
		//_____________________________________________________________________________


		//__________________________MAKE THE D CONNECTOR_______________________________

		FdVector3d dNormals[2] = { dNormal, dNormal };
		double dWidths[2]  = { d, d };
		FdPoint3d dCenters[2] = { dStart, dConn };
		makeBox(1, dCenters, dNormals, ups, dWidths, heights, sides, false, false, 5, (size > flange_2) ? 0 : 5, flange_2 - size);
		//_____________________________________________________________________________
	}

	/**********************************Recover variables*******************************/
	b = copyb;  d = copyd;  r = copyr;  a = copya;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		b -= 2 * size;
		d -= 2 * size;
		r += size;
		a -= 2 * size; 

		//_____________________________MAKE THE BEND___________________________________
		bool sides1[4] = { true, false, true, false };
		makeBend2(bStart, vy, vz, sides1, true, alfa, alfa, b, a, d, n, r, true, false);
		
		bool sides2[4] = { false, true, false, true };
		makeBend2(bStart, vy, vz, sides2, true, alfa, alfa, b, a, d, n, r, true, false);
		//_____________________________________________________________________________

		//__________________________MAKE THE B CONNECTOR_______________________________
		FdVector3d bNormals[3] = { -vy, -vy, -vy }, ups[3] = { vz, vz, vz };
		double bWidths[3]  = { b, b, b }, heights[3] = { a, a, a };
		bool sides[8] = { true, true, true, true, true, true, true, true };
		FdPoint3d bCenters[2] = { bStart, bConn };
		makeBox(1, bCenters, bNormals, ups, bWidths, heights, sides, false, false, 5, 0, size);
		//_____________________________________________________________________________


		//__________________________MAKE THE D CONNECTOR_______________________________

		FdVector3d dNormals[2] = { dNormal, dNormal };
		double dWidths[2]  = { d, d };
		FdPoint3d dCenters[2] = { dStart, dConn };
		makeBox(1, dCenters, dNormals, ups, dWidths, heights, sides, false, false, 5, 0, size);
		//_____________________________________________________________________________
	}
}

void GLERectangular :: makeBO(double a, double b, double flange_1)
{

	FdPoint3d p1, p2;
	//--- Specify a rectangular connector.
	// FdPoint3d p3, p4;
	// double cs = flange_1;
	// p1.set(0,  b / 2.0 + cs,  a / 2.0 + cs); 
	// p2.set(0,  b / 2.0 + cs, -a / 2.0 - cs);
	// p3.set(0, -b / 2.0 - cs, -a / 2.0 - cs);
	// p4.set(0, -b / 2.0 - cs,  a / 2.0 + cs);
	// addRectangularConnector(p1, p2, p3, p4);

	/**********************************GEOMETRY*************************************/
	p1.set(0, 0, 0);
	p2.set(fo, 0, 0);
	FdPoint3d cp[2] = { p1, p2 };
	double tabHeight[2] = { b, b };
	double tabWidth[2] = { a, a };
	FdVector3d v[2] = { vx, vx };
	FdVector3d upv[2] = { vy, vy };
	bool sides[4] = { true, true, true, true };
	makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, true, 0, 5, flange_1);
	addRectangularConnector(cp[0], vx, vy, b + 2 * flange_1, a + 2 * flange_1);


	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		a += 2 * size;
		b += 2 * size;

		p1.set(0, 0, 0);
		p2.set(fo + size, 0, 0);
		FdPoint3d cp[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabHeight[2] = { b, b };
		double tabWidth[2]  = { a, a };
		bool sides[4] = { true, true, true, true };
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, true, (size > flange_1) ? 0 : 5, 5, flange_1 - size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		a -= 2 * size;
		b -= 2 * size;

		p1.set(0, 0, 0);
		p2.set((fo - size > 0) ? (fo - size) : 0, 0, 0);
		FdPoint3d cp[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabHeight[2] = { b, b };
		double tabWidth[2]  = { a, a };
		bool sides[4] = { true, true, true, true };
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, true, 0, 5, size);
	}
}

void GLERectangular :: makeBS(double alfa, double a, double b, double e, double f, double r, double n, double flange_1, double flange_2)
{
	makeBA(alfa, a, b, b, e, f, r, n, flange_1, flange_2);
}

void GLERectangular :: makeCR1(double a, double b, double g, double h, double l, double e, double f, double l3, double flange_1, double flange_2, double flange_3, double flange_4)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	/**********************************GEOMETRY*************************************/
	// inside box
	e -= fo;
	l -= 2 * fo;
	FdPoint3d p1(-l / 2.0 - fo, 0, 0),
	          p2(-l / 2.0,      0, 0),
	          p3( l / 2.0,      0, 0),
	          p4( l / 2.0 + fo, 0, 0);
	FdPoint3d cp[4] = { p1, p2, p3, p4 };
	FdVector3d vec1[4] = { vx, vx, vx, vx };
	double tabWidth[4] = { b, b, b, b };
	double tabHeight[4] = { a, a, a, a };
	bool sides[12] = { true, true,  true, true,
	                   true, false, true, false,
	                   true, true,  true, true };
	bool edges1[7][4] = { true,  true,  true,  true,
	                      true,  true,  true,  true, 
	                      false, false, false, false,
	                      true,  true,  true,  true, 
	                      false, false, false, false,
	                      true,  true,  true,  true, 
	                      true,  true,  true,  true };
	bool con[2] = { false, false };
	makeBox(3, cp, vec1, tabWidth, tabHeight, sides, edges1, con, false, false);

	// close plane
	p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
	p2.set(0, 0, b / 2.0);
	cp[0] = p1;  cp[1] = p2;
	FdVector3d v[2] = { vz, vz };
	FdVector3d upv[2] = { vy, vy };
	double tabHeightP[2] = { g, a };
	double tabWidthP[2] = { h, l };
	bool sidesP[4] = { true, true, true, true };
	bool edges[3][4] = { true,  true,  true,  true,
	                     false, false, false, false,
	                     true,  true,  true,  true };
	makeBox(1, cp, v, upv, tabWidthP, tabHeightP, sidesP, edges, false, false, 5, 5, CONNECTOR_SIZE);

	// far plane
	p1.set(-l / 2.0 + e, a / 2.0 - f, -b / 2.0);
	p2.set(0, 0, -b / 2.0);
	cp[0] = p1;  cp[1] = p2;
	makeBox(1, cp, v, upv, tabWidthP, tabHeightP, sidesP, edges, false, false, 5, 5, CONNECTOR_SIZE);

	// close branch
	p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
	p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
	p3.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
	cp[0] = p1;  cp[1] = p3;
	double tabHeightB[2] = { g, g };
	double tabWidthB[2] = { h, h };
	FdVector3d vB[2] = { vz, vz };
	FdVector3d upvB[2] = { vy, vy };
	bool sidesB[4] = { true, true, true, true };
	makeBox(1, cp, vB, upvB, tabWidthB, tabHeightB, sidesB, false, false, 5, 5, CONNECTOR_SIZE);

	// far branch
	p1.z = -b / 2.0;
	p2.z = -b / 2.0 - l3 + fo;
	p3.z = -b / 2.0 - l3;
	cp[0] = p1;  cp[1] = p3;
	makeBox(1, cp, vB, upvB, tabWidthB, tabHeightB, sidesB, false, false, 5, 5, CONNECTOR_SIZE);

	// Add HLR Info
	//--- specify connector, center, and thin lines for the close branch
	p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
	p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
	p3.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
	addRectangularConnector(p3, vz, vy, g + 2 * flange_4, h + 2 * flange_4);
	makeRectangularFlange(p3, vz, vy, g, h, flange_4);
	addSymbolicFlangeRect(p2, vz, vy, g, h);

	//--- specify connector, center, and thin lines for the far branch
	p1.z = -b / 2.0;  p2.z = -b / 2.0 - l3 + fo;  p3.z = -b / 2.0 - l3;
	addRectangularConnector(p3, vz, vy, g + 2 * flange_3, h + 2 * flange_3);
	makeRectangularFlange(p3, vz, vy, g, h, flange_3);
	addSymbolicFlangeRect(p2, vz, vy, g, h);

	//--- Add two center lines for the branch ducts
	FdPoint3d tp = p3;  tp.z += l3;
	addCenterLine(p3, tp);
	p3.z = b / 2 + l3;  tp.z = b / 2;
	addCenterLine(p3, tp);

	//------- ADD LINES FOR THE MAIN DUCT

	l += fo * 2;
	//--- Add lines that should be drawn as thin, and explicitly
	//--- add thin lines in case they aren't there already.
	drawRectAsThinLines(FdPoint3d(-l / 2 + fo, 0, 0), vx, vy, a, b);
	drawRectAsThinLines(FdPoint3d( l / 2 - fo, 0, 0), vx, vy, a, b);
	addSymbolicFlangeRect(FdPoint3d(-l / 2 + fo, 0, 0), vx, vy, a, b);
	addSymbolicFlangeRect(FdPoint3d( l / 2 - fo, 0, 0), vx, vy, a, b);

	//--- specify two rectangular connectors
	p1.set(-l / 2, 0, 0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);

	p2.set( l / 2, 0, 0);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	//--- add the center line for the duct axis
	p1.set(-l / 2, 0, 0);
	p2.set( l / 2, 0, 0);
	addCenterLine(p1, p2);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyg = g, copyh = h, copyl = l, copye = e, copyf = f, copyl3 = l3;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		// inside box
		b += 2 * size;  a += 2 * size;  f += size;
		l3 -= size;	 g += 2 * size;  h += 2 * size;
		l -= 2 * fo;

		FdPoint3d p1(-l / 2.0 - fo, 0, 0),
		          p2(-l / 2.0,      0, 0),
		          p3( l / 2.0,      0, 0),
		          p4( l / 2.0 + fo, 0, 0);
		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { b, b, b, b };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true, true,  true, true,
		                   true, false, true, false,
		                   true, true,  true, true };
		bool con[2] = { true, true };
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, (size > flange_1) ? 0 : 5, (size > flange_2) ? 0 : 5, (flange_1 > flange_2) ? (flange_2 - size) : (flange_1 - size));

		// close plane
		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(0, 0, b / 2.0);
		cp[0] = p1;  cp[1] = p2;
		v[0] = v[1] = vz;
		upv[0] = upv[1] = vy;
		double tabHeightP[2] = { g, a };
		double tabWidthP[2] = { h, l };
		bool sidesP[4] = { true, true, true, true };
		bool edges[3][4] = { true,  true,  true,  true,
		                     false, false, false, false,
		                     true,  true,  true,  true };
		makeBox(1, cp, v, upv, tabWidthP, tabHeightP, sidesP, edges, false, false, 5, 5, CONNECTOR_SIZE);

		// far plane
		p1.set(-l / 2.0 + e, a / 2.0 - f, -b / 2.0);
		p2.set(0, 0, -b / 2.0);
		cp[0] = p1;  cp[1] = p2;
		makeBox(1, cp, v, upv, tabWidthP, tabHeightP, sidesP, edges, false, false, 5, 5, CONNECTOR_SIZE);

		// close branch
		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
		p3.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
		cp[0] = p1;  cp[1] = p3;
		double tabHeightB[2] = { g, g };
		double tabWidthB[2] = { h, h };
		FdVector3d vB[2] = { vz, vz };
		FdVector3d upvB[2] = { vy, vy };
		bool sidesB[4] = { true, true, true, true };
		makeBox(1, cp, vB, upvB, tabWidthB, tabHeightB, sidesB, false, false, 5, (size > flange_4) ? 0 : 5, flange_4 - size);

		// far branch
		p1.z = -b / 2.0;
		p2.z = -b / 2.0 - l3 + fo;
		p3.z = -b / 2.0 - l3;
		cp[0] = p1;  cp[1] = p3;
		makeBox(1, cp, vB, upvB, tabWidthB, tabHeightB, sidesB, false, false, 5, (size > flange_3) ? 0 : 5, flange_3 - size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  g = copyg;  h = copyh;  l = copyl;  e = copye;  f = copyf;  l3 = copyl3;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		b -= 2 * size;  a -= 2 * size;  f -= size;
		l3 += size;	 g -= 2 * size;  h -= 2 * size;
		l -= 2 * fo;

		FdPoint3d p1(-l / 2.0 - fo, 0, 0),
		          p2(-l / 2.0,      0, 0),
		          p3( l / 2.0,      0, 0),
		          p4( l / 2.0 + fo, 0, 0);
		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { b, b, b, b };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true, true,  true, true,
		                   true, false, true, false,
		                   true, true,  true, true };
		bool con[2] = { true, true };
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, 0, 0, size);

		// close plane
		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(0, 0, b / 2.0);
		cp[0] = p1;  cp[1] = p2;
		v[0] = v[1] = vz;
		upv[0] = upv[1] = vy;
		double tabHeightP[2] = { g, a };
		double tabWidthP[2] = { h, l };
		bool sidesP[4] = { true, true, true, true };
		bool edges[3][4] = { true,  true,  true,  true,
		                     false, false, false, false,
		                     true,  true,  true,  true };
		makeBox(1, cp, v, upv, tabWidthP, tabHeightP, sidesP, edges, false, false, 5, 5, CONNECTOR_SIZE);

		// far plane
		p1.set(-l / 2.0 + e, a / 2.0 - f, -b / 2.0);
		p2.set(0, 0, -b / 2.0);
		cp[0] = p1;  cp[1] = p2;
		makeBox(1, cp, v, upv, tabWidthP, tabHeightP, sidesP, edges, false, false, 5, 5, CONNECTOR_SIZE);

		// close branch
		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
		p3.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
		cp[0] = p1;  cp[1] = p3;
		double tabHeightB[2] = { g, g };
		double tabWidthB[2] = { h, h };
		FdVector3d vB[2] = { vz, vz };
		FdVector3d upvB[2] = { vy, vy };
		bool sidesB[4] = { true, true, true, true };
		makeBox(1, cp, vB, upvB, tabWidthB, tabHeightB, sidesB, false, false, 5, 0, size);

		// far branch
		p1.z = -b / 2.0;
		p2.z = -b / 2.0 - l3 + fo;
		p3.z = -b / 2.0 - l3;
		cp[0] = p1;  cp[1] = p3;
		makeBox(1, cp, vB, upvB, tabWidthB, tabHeightB, sidesB, false, false, 5, 0, size);
	}
}

void GLERectangular :: makeCR2(double height, double width, double diam1, double length1, double length2, double e, double f, int n, double flange_1, double flange_2)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	/**********************************GEOMETRY*************************************/

	// the first plane with circular hole (front)
	FdPoint3d p1(0, 0, width / 2), p2, p3, p4;
	double heightWidth[2] = { length1 - 2 * fo, height };
	FdPoint3d ts(-length1 / 2 + e, height / 2 - f, width / 2);
	double tubeParams[3] = { diam1, diam1, 0 };
	makeRectToTubeTransition(p1, vz, vx, heightWidth, ts, tubeParams, n);

	// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
	p1.set(-length1 / 2 + e, height / 2 - f, width / 2);
	p2.set(-length1 / 2 + e, height / 2 - f, width / 2 + length2);
	FdPoint3d cp[2] = { p1, p2 };
	makeVerySimpleTube(cp, diam1, n);

	addCircularConnector(p2);
	drawAsThinArc(p1);

	// the second plane with circular hole (back)
	p1.set(0, 0, -width / 2);
	double heightWidth2[2] = { length1 - 2 * fo, height };
	ts.set(-length1 / 2 + e, height / 2 - f, -width / 2);
	double tubeParams2[3] = { diam1, diam1, 0 };
	makeRectToTubeTransition(p1, -vz, vx, heightWidth2, ts, tubeParams2, n);

	// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
	p1.set(-length1 / 2 + e, height / 2 - f, -width / 2);
	p2.set(-length1 / 2 + e, height / 2 - f, -width / 2 - length2);
	FdPoint3d cp1[2] = { p1, p2 };
	makeVerySimpleTube(cp1, diam1, n);

	addCircularConnector(p2);
	drawAsThinArc(p1);

	addCenterLine(cp[0], cp[1]);
	addCenterLine(cp1[0], cp1[1]);

	p1.set(-length1 / 2.0,      0, 0);
	p2.set(-length1 / 2.0 + fo, 0, 0);
	p3.set( length1 / 2.0 - fo, 0, 0);
	p4.set( length1 / 2.0,      0, 0);
	FdPoint3d p[4] = { p1, p2, p3, p4 };
	FdVector3d vec1[4] = { vx, vx, vx, vx };
	double tabWidth[4] = { width, width, width, width };
	double tabHeight[4]= { height, height, height, height };
	bool sides[12] = { true, true,  true, true,
	                   true, false, true, false,
	                   true, true,  true, true };
	bool edges1[7][4] = { true,  true,  true,  true,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      true,  true,  true,  true };
	bool con[2] = { false, false };
	makeBox(3, p, vec1, tabWidth, tabHeight, sides, edges1, con, false, false);

	/****************************Copy/create Insulation vairables*******************/
	double copyheight = height, copywidth = width, copy = diam1;
	double copylength1 = length1, copylength2 = length2, copye = e, copyf = f;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		// makeCR2(a, b, d, l, fo, e, f, fo, fs, SEGNUM(d));
		// a, b, d, f
		height += size * 2;  width += size * 2;  diam1 += 2 * size;
		f += size;  length2 -=size;

		// the first plane with circular hole (front)
		FdPoint3d p1(0, 0, width / 2), p2, p3, p4;
		double heightWidth[2] = { length1 - 2 * fo, height };
		FdPoint3d ts(-length1 / 2 + e, height / 2 - f, width / 2);
		double tubeParams[3] = { diam1, diam1, 0 };
		makeRectToTubeTransition(p1, vz, vx, heightWidth, ts, tubeParams, n);

		// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
		p1.set(-length1 / 2 + e, height / 2 - f, width / 2);
		p2.set(-length1 / 2 + e, height / 2 - f, width / 2 + length2);
		FdPoint3d cp[2] = { p1, p2 };
		makeVerySimpleTube(cp, diam1, n);

		// flat discs at the end of the tube
		makeFlatRing(p2, vz, diam1, diam1 - 2 * size, n);

		// the second plane with circular hole (back)
		p1.set(0, 0, -width / 2);
		double heightWidth2[2] = { length1 - 2 * fo, height };
		ts.set(-length1 / 2 + e, height / 2 - f, -width / 2);
		double tubeParams2[3] = { diam1, diam1, 0 };
		makeRectToTubeTransition(p1, vz, vx, heightWidth2, ts, tubeParams2, n);

		// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
		p1.set(-length1 / 2 + e, height / 2 - f, -width / 2);
		p2.set(-length1 / 2 + e, height / 2 - f, -width / 2 - length2);
		FdPoint3d cp1[2] = { p1, p2 };
		makeVerySimpleTube(cp1, diam1, n);

		// flat discs at the end of the tube
		makeFlatRing(p2, vz, diam1, diam1 - 2 * size, n);

		p1.set(-length1 / 2.0,      0, 0);
		p2.set(-length1 / 2.0 + fo, 0, 0);
		p3.set( length1 / 2.0 - fo, 0, 0);
		p4.set( length1 / 2.0,      0, 0);
		FdPoint3d p[4] = { p1, p2, p3, p4 };
		double tabWidth[4] = { width, width, width, width };
		double tabHeight[4] = { height, height, height, height };
		bool sides[12] = { true, true,  true, true,
		                   true, false, true, false,
		                   true, true,  true, true };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		makeBox(3, p, v, upv, tabWidth, tabHeight, sides, edges1, false, false, (size > flange_1) ? 0 : 5, (size > flange_2) ? 0 : 5, (flange_1 > flange_2) ? (flange_2 - size) : (flange_1 - size));
	}

	/**********************************Recover variables*******************************/
	height = copyheight;  width = copywidth;  diam1 = copy;
	length1 = copylength1;  length2 = copylength2;  e = copye;  f = copyf;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		height -= size * 2;  width -= size * 2;  diam1 -= 2 * size;
		f -= size;  length2 += size;

		// the first plane with circular hole (front)
		FdPoint3d p1(0, 0, width / 2), p2, p3, p4;
		double heightWidth[2] = { length1 - 2 * fo, height };
		FdPoint3d ts(-length1 / 2 + e, height / 2 - f, width / 2);
		double tubeParams[3] = { diam1, diam1, 0 };
		makeRectToTubeTransition(p1, vz, vx, heightWidth, ts, tubeParams, n);

		// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
		p1.set(-length1 / 2 + e, height / 2 - f, width / 2);
		p2.set(-length1 / 2 + e, height / 2 - f, width / 2 + length2);
		FdPoint3d cp[2] = { p1, p2 };
		makeVerySimpleTube(cp, diam1, n);

		// flat discs at the end of the tube
		makeFlatRing(p2, vz, diam1, diam1 + 2 * size, n);

		// the second plane with circular hole (back)
		p1.set(0, 0, -width / 2);
		double heightWidth2[2] = { length1 - 2 * fo, height };
		ts.set(-length1 / 2 + e, height / 2 - f, -width / 2);
		double tubeParams2[3] = { diam1, diam1, 0 };
		makeRectToTubeTransition(p1, vz, vx, heightWidth2, ts, tubeParams2, n);

		// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
		p1.set(-length1 / 2 + e, height / 2 - f, -width / 2);
		p2.set(-length1 / 2 + e, height / 2 - f, -width / 2 - length2);
		FdPoint3d cp1[2] = { p1, p2 };
		makeVerySimpleTube(cp1, diam1, n);

		// flat discs at the end of the tube
		makeFlatRing(p2, vz, diam1, diam1 + 2 * size, n);

		p1.set(-length1 / 2.0,      0, 0);
		p2.set(-length1 / 2.0 + fo, 0, 0);
		p3.set( length1 / 2.0 - fo, 0, 0);
		p4.set( length1 / 2.0,      0, 0);
		FdPoint3d p[4] = { p1, p2, p3, p4 };
		double tabWidth[4] = { width, width, width, width };
		double tabHeight[4] = { height, height, height, height };
		bool sides[12] = { true, true,  true, true,
		                   true, false, true, false,
		                   true, true,  true, true };
		FdVector3d v[4]  = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		makeBox(3, p, v, upv, tabWidth, tabHeight, sides, edges1, false, false, 0, 0, size);
	}

	/**********************************Recover variables*******************************/
	height = copyheight;  width = copywidth;  diam1 = copy;
	length1 = copylength1;  length2 = copylength2;  e = copye;  f = copyf;
	setPrimitiveMode(FLM3Geo::pmNormal);

	//------- SPECIFY LINES FOR THE MAIN DUCT

	//--- specify lines that should be drawn as thin
	p1.set(-length1 / 2 + fo, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, height, width);
	drawRectAsThinLines(p1, vx, vy, height, width);

	p1.set( length1 / 2 - fo, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, height, width);
	drawRectAsThinLines(p1, vx, vy, height, width);

	//--- specify two rectangular connectors
	p1.set(-length1 / 2, 0, 0);
	addRectangularConnector(p1, vx, vy, height + 2 * flange_1, width + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, height, width, flange_1);

	p1.set( length1 / 2, 0, 0);
	addRectangularConnector(p1, vx, vy, height + 2 * flange_2, width + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, height, width, flange_2);

	//--- add the center lines for the duct axis
	p1.set(-length1 / 2, 0.0, 0.0);
	p2.set( length1 / 2, 0.0, 0.0);
	addCenterLine(p1, p2);
}

void GLERectangular :: makeCR5(double a, double b, double d, double h, double j, double e, double l, double flange_1, double flange_2, double flange_3, double flange_4)
{
	/**********************************GEOMETRY*************************************/
	postTransformMesh( M_PI / 2, FdVector3d::kXAxis);
	postTransformMesh(-M_PI / 2, FdVector3d::kZAxis);

	// inside box
	FdPoint3d p1, p2, p3, p4, p5;
	p1.set(0, 0, -l / 2.0);
	p2.set(0, 0, -l / 2.0 + fo);
	p3.set(0, 0,  l / 2.0 - fo);
	p4.set(0, 0,  l / 2.0);

	FdPoint3d cp[2] = { p1, p4 };
	double tabWidth[2] = { a, a };  // we have to remember how perpVector works...
	double tabHeight[2] = { h, h };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };
	makeBox(1, cp, tabWidth, tabHeight, sides, con, false, false);

	//--- specify two rectangular connectors
	p1.set(0, 0,  l / 2);
	addRectangularConnector(p1, vz, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vz, vy, a, b, flange_1);

	p1.set(0, 0, -l / 2);
	// addRectangularConnector(p1, vz, vy, a + 2 * cs, h + 2 * cs);
	addRectangularConnector(p1, vz, vy, a + 2 * flange_2, h + 2 * flange_2);
	makeRectangularFlange(p1, vz, vy, a, h, flange_2);

	p1.set(0, 0,  l / 2 - fo);
	addSymbolicFlangeRect(p1, vz, vy, a, b);

	p1.set(0, 0, -l / 2 + fo);
	addSymbolicFlangeRect(p1, vz, vy, a, h);

	//--- add the center lines for...
	// for the duct axis
	p1.set(0, 0, -l / 2);
	p2.set(0, 0,  l / 2);
	addCenterLine(p1, p2);

	// left box1
	p1.set(-b / 2.0 + (b - h) / 4.0, 0, l / 2.0);
	p2.set(-b / 2.0 + (b - h) / 4.0, 0, l / 2.0 - fo);
	p3.set(-b / 2.0 + (b - h) / 4.0, 0, l / 2.0 - e - d / 2.0);
	p4.set(-b / 2.0 - e + fo, 0, l / 2.0 - e - d / 2.0);
	p5.set(-b / 2.0 - e, 0, l / 2.0 - e - d / 2.0);

	FdPoint3d cp2[3] = { p1, p3, p5 };

	double middleWidth = ((b - h) / 2.0) * ((b - h) / 2.0) + d * d;
	middleWidth = pow(middleWidth, 0.5);
	double tabWidth2[3] = { (b - h) / 2.0, middleWidth, d };
	double tabHeight2[3] = { a, a, a };
	double x = (b - h) / 2.0;
	double y = d;

	FdVector3d v1((y * y) / (2 * x), 0, y / 2);
	FdVector3d vectors2[3] = { vz, v1, vx };
	FdVector3d upVectors2[3] = { vy, vy, vy };

	bool sides2[8] = { true, true, true, true,
	                   true, true, true, true };
	bool edges[9][4] = { true,  true, true,  true,
	                     true,  true, true,  true,
	                     false, true, false, true,
	                     true,  true, true,  true,
	                     true,  true, true,  true };
	makeBox(2, cp2, vectors2, upVectors2, tabWidth2, tabHeight2, sides2, edges, false, false, 0, 5, false);

	//--- specify a rectangular connector
	// addRectangularConnector(p5, vx, vy, a + 2 * cs, d + 2 * cs);
	addRectangularConnector(p5, vx, vy, a + 2 * flange_3, d + 2 * flange_3);
	makeRectangularFlange(p5, vx, vy, a, d, flange_3);
	addSymbolicFlangeRect(p4, vx, vy, a, d);

	//--- center lines for the left box
	p1.set(cp[1].x - h / 2 - (b - h) / 4, cp[1].y, cp[1].z);
	p2.set(cp[1].x - h / 2 - (b - h) / 4, cp[1].y, cp[1].z - e - d / 2);
	addCenterLine(p1, p2);
	addCenterLine(p2, cp2[2]);

	// right box1
	p1.set(b / 2.0 - (b - h) / 4.0, 0, l / 2.0);
	p2.set(b / 2.0 - (b - h) / 4.0, 0, l / 2.0 - fo);
	p3.set(b / 2.0 - (b - h) / 4.0, 0, l / 2.0 - e - j / 2.0);
	p4.set(b / 2.0 + e - fo,        0, l / 2.0 - e - j / 2.0);
	p5.set(b / 2.0 + e,             0, l / 2.0 - e - j / 2.0);

	FdPoint3d cp3[3] = { p1, p3, p5 };

	middleWidth = ((b - h) / 2.0) * ((b - h) / 2.0) + j * j;
	middleWidth = pow(middleWidth, 0.5);
	double tabWidth3[3] = { (b - h) / 2.0, middleWidth, j };
	double tabHeight3[3] = { a, a, a };
	x = (b - h) / 2.0;  y = j;

	v1.set(-(y * y) / (2 * x), 0, y / 2);
	FdVector3d vectors3[3] = { vz, v1, -vx };
	FdVector3d upVectors3[3] = { vy, vy, vy };
	bool sides3[8] = { true, true, true, true,
	                   true, true, true, true };
	makeBox(2, cp3, vectors3, upVectors3, tabWidth3, tabHeight3, sides3, edges, false, false, 0, 5, false);

	//--- specify a rectangular connector
	// addRectangularConnector(p5, vx, vy, a + 2 * cs, j + 2 * cs);
	addRectangularConnector(p5, vx, vy, a + 2 * flange_4, j + 2 * flange_4);
	makeRectangularFlange(p5, vx, vy, a, j, flange_4);
	addSymbolicFlangeRect(p4, vx, vy, a, j);

	//--- center lines for right box
	p1.set(cp[1].x + h / 2 + (b - h) / 4, cp[1].y, cp[1].z);
	p2.set(cp[1].x + h / 2 + (b - h) / 4, cp[1].y, cp[1].z - e - j / 2);
	addCenterLine(p1, p2);
	addCenterLine(p2, cp3[2]);

	// front connector
	p1.set(0, 0, l / 2.0);
	double width4 = a;
	double height4 = b;
	// makeConnector(p1, vz, width4, height4);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyd = d, copyh = h, copyj = j, copye = e, copyl = l;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		b += 2 * size;  h += 2 * size;  a += 2 * size;  j += 2 * size;  d += 2 * size;
		e -= size;

		// inside box
		FdPoint3d p1, p2, p3, p4, p5, p6;
		p1.set(0, 0, -l / 2.0);
		p2.set(0, 0, -l / 2.0 + fo);
		p3.set(0, 0,  l / 2.0 - fo);
		p4.set(0, 0,  l / 2.0);
		p5.set(0, 0,  l / 2 - (d + e));
		p6.set(0, 0,  l / 2 - (j + e));

		double tabWidth[6] = { a, a, a, a, a, a };  // we have to remember how perpVector works...
		double tabHeight[6] = { h, h, h, h, h, h };

		if( d > j )
		{
			FdPoint3d cp[6] = { p1, p2, p5, p6, p3, p4 };
			bool sides[20] = { true,  true, true,  true,
			                   true,  true, true,  true,
			                   true,  true, false, true,
			                   false, true, false, true,
			                   false, true, false, true };
			// bool con[2] = { true, false };
            // makeBox(5, cp, tabWidth, tabHeight, sides, con, false, false);
			FdVector3d vb[6] = { vz, vz, vz, vz, vz, vz };
			FdVector3d upvb[6] = { vx, vx, vx, vx, vx, vx };
			makeBox(5, cp, vb, upvb, tabWidth, tabHeight, sides, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);
		}
		else if( d < j )
		{
			FdPoint3d cp[6] = { p1, p2, p6, p5, p3, p4 };
			bool sides[20] = { true,  true, true,  true,
			                   true,  true, true,  true,
			                   false, true, true,  true,
			                   false, true, false, true,
			                   false, true, false, true };
			// bool con[2] = { true, false };
			// makeBox(5, cp, tabWidth, tabHeight, sides, con, false, false);
			FdVector3d vb[6] = { vz, vz, vz, vz, vz, vz };
			FdVector3d upvb[6] = { vx, vx, vx, vx, vx, vx };
			makeBox(5, cp, vb, upvb, tabWidth, tabHeight, sides, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);
		}
		else  // d == j :D
		{
			FdPoint3d cp[5] = { p1, p2, p5, p3, p4 };
			bool sides[16] = { true,  true, true,  true,
			                   true,  true, true,  true,
			                   false, true, false, true,
			                   false, true, false, true };
			// bool con[2] = { true, false };
			// makeBox(4, cp, tabWidth, tabHeight, sides, con, false, false);
			FdVector3d vb[5] = { vz, vz, vz, vz, vz };
			FdVector3d upvb[5] = { vx, vx, vx, vx, vx };
			makeBox(4, cp, vb, upvb, tabWidth, tabHeight, sides, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);
		}
		
		// left box1
		p1.set(-b / 2.0 + (b - h) / 4.0, 0, l / 2.0);
		p2.set(-b / 2.0 + (b - h) / 4.0, 0, l / 2.0 - fo);
		p3.set(-b / 2.0 + (b - h) / 4.0, 0, l / 2.0 - e - d / 2.0);
		p4.set(-b / 2.0 - e + fo, 0, l / 2.0 - e - d / 2.0);
		p5.set(-b / 2.0 - e, 0, l / 2.0 - e - d / 2.0);

		FdPoint3d cp2[3] = { p1, p3, p5 };

		double middleWidth = ((b - h) / 2.0) * ((b - h) / 2.0) + d * d;
		middleWidth = pow(middleWidth, 0.5);
		double tabWidth2[3] = { (b - h) / 2.0, middleWidth, d };
		double tabHeight2[3] = { a, a, a };
		double x = (b - h) / 2.0;
		double y = d;

		FdVector3d v1((y * y) / (2 * x), 0, y / 2);
		FdVector3d vectors2[3] = { vz, v1, vx };
		FdVector3d upVectors2[3] = { vy, vy, vy };

		bool sides2[8] = { true, true, true, false,
		                   true, true, true, true };
		bool edges[5][4] = { true,  true, true,  true,
		                     true,  true, true,  true,
		                     false, true, false, true,
		                     true,  true, true,  true,
		                     true,  true, true,  true };
		makeBox(2, cp2, vectors2, upVectors2, tabWidth2, tabHeight2, sides2, edges, false, false, 5, (size > flange_3) ? 0 : 5, flange_3 - size);

		// right box1
		p1.set(b / 2.0 - (b - h) / 4.0, 0, l / 2.0);
		p2.set(b / 2.0 - (b - h) / 4.0, 0, l / 2.0 - fo);
		p3.set(b / 2.0 - (b - h) / 4.0, 0, l / 2.0 - e - j / 2.0);
		p4.set(b / 2.0 + e - fo,        0, l / 2.0 - e - j / 2.0);
		p5.set(b / 2.0 + e,             0, l / 2.0 - e - j / 2.0);

		FdPoint3d cp3[3] = { p1, p3, p5 };

		middleWidth = ((b - h) / 2.0) * ((b - h) / 2.0) + j * j;
		middleWidth = pow(middleWidth, 0.5);
		double tabWidth3[3] = { (b - h) / 2.0, middleWidth, j };
		double tabHeight3[3] = { a, a, a };
		x = (b - h) / 2.0;  y = j;

		v1.set(-(y * y) / (2 * x), 0, y / 2);
		FdVector3d vectors3[3] = { vz, v1, -vx };
		FdVector3d upVectors3[3] = { vy, vy, vy };
		bool sides3[8] = { true, false, true, true,
		                   true, true, true, true };
		makeBox(2, cp3, vectors3, upVectors3, tabWidth3, tabHeight3, sides3, edges, false, false, 5, (size > flange_4) ? 0 : 5, flange_4 - size);

		// front connector
		if( size > flange_1 )
		{
			p1.set(0, 0, l / 2.0);
			makeConnector(p1, vz, vy, b, a, flange_1 - size);
		}
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  h = copyh;  j = copyj;  e = copye;  l = copyl;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		b -= 2 * size;  h -= 2 * size;  a -= 2 * size;  j -= 2 * size;  d -= 2 * size;
		e += size;

		// inside box
		FdPoint3d p1, p2, p3, p4, p5;
		p1.set(0, 0, -l / 2.0);
		p2.set(0, 0, -l / 2.0 + fo);
		p3.set(0, 0,  l / 2.0 - fo);
		p4.set(0, 0,  l / 2.0);

		FdPoint3d cp[2] = { p1, p4 };
		double tabWidth[4] = { a, a };  // we have to remember how perpVector works...
		double tabHeight[4] = { h, h };
		bool sides[4] = { true, true, true, true };
		FdVector3d vb1[2] = { vz, vz };
		FdVector3d upvb1[2] = { vx, vx };
		makeBox(1, cp, vb1, upvb1, tabWidth, tabHeight, sides, false, false, 0, 5, size);

		// left box1
		p1.set(-b / 2.0 + (b - h) / 4.0, 0, l / 2.0);
		p2.set(-b / 2.0 + (b - h) / 4.0, 0, l / 2.0 - fo);
		p3.set(-b / 2.0 + (b - h) / 4.0, 0, l / 2.0 - e - d / 2.0);
		p4.set(-b / 2.0 - e + fo, 0, l / 2.0 - e - d / 2.0);
		p5.set(-b / 2.0 - e, 0, l / 2.0 - e - d / 2.0);

		FdPoint3d cp2[3] = { p1, p3, p5 };

		double middleWidth = ((b - h) / 2.0) * ((b - h) / 2.0) + d * d;
		middleWidth = pow(middleWidth, 0.5);
		double tabWidth2[3] = { (b - h) / 2.0, middleWidth, d };
		double tabHeight2[3] = { a, a, a };
		double x = (b - h) / 2.0;
		double y = d;

		FdVector3d v1((y * y) / (2 * x), 0, y / 2);
		FdVector3d vectors2[3] = { vz, v1, vx };
		FdVector3d upVectors2[3] = { vy, vy, vy };

		bool sides2[8] = { true, true, true, true,
		                   true, true, true, true };
		bool edges[5][4] = { true,  true, true,  true,
		                     true,  true, true,  true,
		                     false, true, false, true,
		                     true,  true, true,  true,
		                     true,  true, true,  true };
		makeBox(2, cp2, vectors2, upVectors2, tabWidth2, tabHeight2, sides2, edges, false, false, 5, 0, size);

		// right box1
		p1.set(b / 2.0 - (b - h) / 4.0, 0, l / 2.0);
		p2.set(b / 2.0 - (b - h) / 4.0, 0, l / 2.0 - fo);
		p3.set(b / 2.0 - (b - h) / 4.0, 0, l / 2.0 - e - j / 2.0);
		p4.set(b / 2.0 + e - fo,        0, l / 2.0 - e - j / 2.0);
		p5.set(b / 2.0 + e,             0, l / 2.0 - e - j / 2.0);

		FdPoint3d cp3[3] = { p1, p3, p5 };

		middleWidth = ((b - h) / 2.0) * ((b - h) / 2.0) + j * j;
		middleWidth = pow(middleWidth, 0.5);
		double tabWidth3[3] = { (b - h) / 2.0, middleWidth, j };
		double tabHeight3[3] = { a, a, a };
		x = (b - h) / 2.0;  y = j;

		v1.set(-(y * y) / (2 * x), 0, y / 2);
		FdVector3d vectors3[3] = { vz, v1, -vx };
		FdVector3d upVectors3[3] = { vy, vy, vy };
		bool sides3[8] = { true, true, true, true,
		                   true, true, true, true };
		makeBox(2, cp3, vectors3, upVectors3, tabWidth3, tabHeight3, sides3, edges, false, false, 5, 0, size);

		// front connector
		p1.set(0, 0, l / 2.0);
		double width4 = a;
		double height4 = b;
		makeConnector(p1, vz, vx, width4, height4, size);

        p1.set(-h / 2 - 2 * size, -a / 2, l / 2.0);
		p2.set(-h / 2 - 2 * size,  a / 2, l / 2.0);
		p3.set(-h / 2 - 2 * size,  a / 2, l / 2.0 - e - d);
		p4.set(-h / 2 - 2 * size, -a / 2, l / 2.0 - e - d);
		makePlane(p1, p2, p3, p4);

		p1.set(-h / 2 - 2 * size, -a / 2, l / 2.0);
		p2.set(-h / 2 - 2 * size,  a / 2, l / 2.0);
		p3.set(-h / 2,   a / 2, l / 2.0);
		p4.set(-h / 2, - a / 2, l / 2.0);
		makePlane(p1, p2, p3, p4);
		
		p1.set(h / 2 + 2 * size, -a / 2, l / 2.0);
		p2.set(h / 2 + 2 * size,  a / 2, l / 2.0);
		p3.set(h / 2 + 2 * size,  a / 2, l / 2.0 - e - j);
		p4.set(h / 2 + 2 * size, -a / 2, l / 2.0 - e - j);
		makePlane(p1, p2, p3, p4);

		p1.set(h / 2, -a / 2, l / 2.0);
		p2.set(h / 2,  a / 2, l / 2.0);
		p3.set(h / 2 + 2 * size,  a / 2, l / 2.0);
		p4.set(h / 2 + 2 * size, -a / 2, l / 2.0);
		makePlane(p1, p2, p3, p4);
	}
}

void GLERectangular :: makeEA(double a, double b, double d, double e, double l, double flange_1, double flange_2)
{
	short k = 1;
	ads_real v1 = 0, v2 = 0;
	ads_real cosa, sina, arg;
	ads_real x = b - e, lp = l - 2 * fo;

	arg = lp * lp + x * x - b * b;
	if( arg < 0 )  arg = 0;
	cosa = (b * x + lp * sqrt(arg)) / (lp * lp + x * x);
	if( cosa > -1 && cosa < 1 )
		{
		sina = sqrt(1 - cosa * cosa);
		v1 = lp - (b - x) * cosa / sina;
		if( v1 < 0 )   v1 = 0;
		if( v1 > lp )  v1 = (d > e) ? 0 : lp;
		};

	arg = lp * lp + x * x - d * d;
	if( arg < 0 )  arg = 0;
	cosa = (d * x + lp * sqrt(arg)) / (lp * lp + x * x);
	if( cosa > -1 && cosa < 1 )
		{
		sina = sqrt(1 - cosa * cosa);
		v2 = lp - (d - x) * cosa / sina;
		if( v2 < 0  )  v2 = 0;
		if( v2 > lp )  v2 = (b > e) ? 0 : lp;
		};


	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	/**********************************GEOMETRY*************************************/
	double move = (d - b) / 2.0;
	FdPoint3d S1 ( -l / 2.0 + fo, 0,  (d - b) / 2.0 - move );
	FdPoint3d S2 (  l / 2.0 - fo, 0, -e             - move );
	FdPoint3d S11( -l / 2.0,      0, (d - b) / 2.0  - move );
	FdPoint3d S22(  l / 2.0,      0, -e             - move );

	FdPoint3d W1(S11.x + fo + v1 / 2, S11.y, S11.z),
	          W2(S22.x - fo - v2 / 2, S22.y, S22.z);
	double dist1 = sqrt(b * b / 4 + v1 * v1 / 4),
	       dist2 = sqrt(d * d / 4 + v2 * v2 / 4);
	FdVector3d vd1(v1, 0, b);  vd1.normalize();
	FdVector3d vd2(v2, 0, d);  vd2.normalize();

	FdPoint3d cp[4] = { S11, W1, W2, S22 };
	FdVector3d v[4] = { vx, vx, vx, vx };
	FdVector3d upv[4] = { vz, vd1, vd2, vz };
	double tabWidth[4] = { a, a, a, a };
	double tabHeight[4] = { b, dist1 * 2, dist2 * 2, d };
	bool sides[12];
	for( int i = 0; i < 12; i++ )
		sides[i] = true;
	int flange = (flange_1 == flange_2) ? 0 : 5;
	makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, false, false, flange, flange, flange_1);


	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb =  b, copyd = d, copye = e, copyl = l;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d W1o = W1, W2o = W2;
		FdPoint3d A1o = FdPoint3d(W1o.x + vd1.x * dist1, W1o.y, W1o.z + vd1.z * dist1);
		FdPoint3d A2o = FdPoint3d(W2o.x + vd2.x * dist2, W2o.y, W2o.z + vd2.z * dist2);
		FdPoint3d B1o = FdPoint3d(W1o.x - vd1.x * dist1, W1o.y, W1o.z - vd1.z * dist1);
		FdPoint3d B2o = FdPoint3d(W2o.x - vd2.x * dist2, W2o.y, W2o.z - vd2.z * dist2);

		FdVector3d vAo = A2o - A1o;
		FdVector3d vBo = B2o - B1o;
		double distA = sqrt(vAo.x * vAo.x + vAo.z * vAo.z);
		double sinA = vAo.z / distA, cosA = vAo.x / distA;
		double distB = sqrt(vBo.x * vBo.x + vBo.z * vBo.z);
		double sinB = vBo.z / distB, cosB = vBo.x / distB;
		A1o += FdVector3d(-size * (1 - cosA) / sinA, 0, size);
		A2o += FdVector3d(-size * (1 - cosA) / sinA, 0, size);
		B1o -= FdVector3d(-size * (1 - cosB) / sinB, 0, size);
		B2o -= FdVector3d(-size * (1 - cosB) / sinB, 0, size);

		double dist1o = (A1o - B1o).length() / 2;
		double dist2o = (A2o - B2o).length() / 2;
		W1o = FdPoint3d((A1o.x + B1o.x) / 2, (A1o.y + B1o.y) / 2, (A1o.z + B1o.z) / 2);
		W2o = FdPoint3d((A2o.x + B2o.x) / 2, (A2o.y + B2o.y) / 2, (A2o.z + B2o.z) / 2);
		FdVector3d vd1o = FdVector3d(2 * (A1o.x - B1o.x) / dist1o, 0, 2 * (A1o.z - B1o.z) / dist1o);
		FdVector3d vd2o = FdVector3d(2 * (A2o.x - B2o.x) / dist2o, 0, 2 * (A2o.z - B2o.z) / dist2o);

		b += 2 * size;  a += 2 * size;  d += 2 * size;
		move = (d - b) / 2.0;
		FdPoint3d S11( -l / 2.0,      0,  (d - b) / 2.0 - move );
		FdPoint3d S22(  l / 2.0,      0, -e             - move );

		FdPoint3d cp[4] = { S11, W1o, W2o, S22 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vz, vd1o, vd2o, vz };
		double tabWidth[4] = { a, a, a, a };
		double tabHeight[4] = { b, dist1o * 2, dist2o * 2, d };

		int flange_size = flange_1 - size;
		int flange1 = (size > flange_1) ? 0 : 5;
		int flange2 = (size > flange_2) ? 0 : 5;
		if( flange_1 != flange_2 )
		{
			if( size > flange_1 && size > flange_2 )
				flange1 = flange2 = 5;
			else if( size > flange_2 )
				flange_size = flange_2 - size;
		}
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, false, false, flange1, flange2, flange_size);

		if( flange_1 != flange_2 && size > flange_1 && size > flange_2 )
		{
			makeRectangularFlange(S11, vx, vy, a - 2 * size + 2 * flange_1, b - 2 * size + 2 * flange_1, size - flange_1);
			makeRectangularFlange(S22, vx, vy, a - 2 * size + 2 * flange_2, d - 2 * size + 2 * flange_2, size - flange_2);
		}
	}


	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  e = copye;  l = copyl;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		FdPoint3d W1i = W1, W2i = W2;
		FdPoint3d A1i = FdPoint3d(W1i.x + vd1.x * dist1, W1i.y, W1i.z + vd1.z * dist1);
		FdPoint3d A2i = FdPoint3d(W2i.x + vd2.x * dist2, W2i.y, W2i.z + vd2.z * dist2);
		FdPoint3d B1i = FdPoint3d(W1i.x - vd1.x * dist1, W1i.y, W1i.z - vd1.z * dist1);
		FdPoint3d B2i = FdPoint3d(W2i.x - vd2.x * dist2, W2i.y, W2i.z - vd2.z * dist2);

		FdVector3d vAi = A2i - A1i;
		FdVector3d vBi = B2i - B1i;
		double distA = sqrt(vAi.x * vAi.x + vAi.z * vAi.z);
		double sinA = vAi.z / distA, cosA = vAi.x / distA;
		double distB = sqrt(vBi.x * vBi.x + vBi.z * vBi.z);
		double sinB = vBi.z / distB, cosB = vBi.x / distB;
		A1i += FdVector3d(size * (1 - cosA) / sinA, 0, -size);
		A2i += FdVector3d(size * (1 - cosA) / sinA, 0, -size);
		B1i -= FdVector3d(size * (1 - cosB) / sinB, 0, -size);
		B2i -= FdVector3d(size * (1 - cosB) / sinB, 0, -size);

		double dist1i = (A1i - B1i).length() / 2;
		double dist2i = (A2i - B2i).length() / 2;
		W1i = FdPoint3d((A1i.x + B1i.x) / 2, (A1i.y + B1i.y) / 2, (A1i.z + B1i.z) / 2);
		W2i = FdPoint3d((A2i.x + B2i.x) / 2, (A2i.y + B2i.y) / 2, (A2i.z + B2i.z) / 2);
		FdVector3d vd1i = FdVector3d(2 * (A1i.x - B1i.x) / dist1i, 0, 2 * (A1i.z - B1i.z) / dist1i);
		FdVector3d vd2i = FdVector3d(2 * (A2i.x - B2i.x) / dist2i, 0, 2 * (A2i.z - B2i.z) / dist2i);

		b -= 2 * size;  a -= 2 * size;  d -= 2 * size;
		move = (d - b) / 2.0;
		FdPoint3d S11( -l / 2.0,      0,  (d - b) / 2.0 - move );
		FdPoint3d S22(  l / 2.0,      0, -e             - move );

		FdPoint3d cp[4] = { S11, W1i, W2i, S22 };
		FdVector3d v[4] = { vx, vx,  vx, vx };
		FdVector3d upv[4] = { vz, vd1i, vd2i, vz };
		double tabWidth[4] = { a, a, a, a };
		double tabHeight[4] = { b, dist1i * 2, dist2i * 2,  d };
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, false, false, 0, 0, size);
	}

	a = copya;  b = copyb;  d = copyd;  e = copye;  l = copyl;
	setPrimitiveMode(FLM3Geo::pmNormal);

	addCenterPolyLine(cp, 3);

	addSymbolicFlangeRect(S1, vx, vy, a, b);
	addSymbolicFlangeRect(S2, vx, vy, a, d);
	addRectangularConnector(S11, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(S22, vx, vy, a + 2 * flange_2, d + 2 * flange_2);

	if( flange_1 != flange_2 )
	{
		makeRectangularFlange(S11, vx, vy, a, b, flange_1);
		makeRectangularFlange(S22, vx, vy, a, d, flange_2);
	}

	//--- draw the two "joint" rectangles as thin
	FdPoint3d p1, p2, p3, p4;
	double xDist = fabs(W1.x - S1.x);
	p1.set(cp[1].x + xDist, cp[1].y + a / 2, cp[1].z + b / 2);
	p2.set(cp[1].x - xDist, cp[1].y + a / 2, cp[1].z - b / 2);
	p3.set(cp[1].x - xDist, cp[1].y - a / 2, cp[1].z - b / 2);
	p4.set(cp[1].x + xDist, cp[1].y - a / 2, cp[1].z + b / 2);
	drawRectAsThinLines(p1, p2, p3, p4);

	xDist = fabs(S2.x - W2.x);
	p1.set(cp[2].x + xDist, cp[2].y + a / 2, cp[2].z + d / 2);
	p2.set(cp[2].x - xDist, cp[2].y + a / 2, cp[2].z - d / 2);
	p3.set(cp[2].x - xDist, cp[2].y - a / 2, cp[2].z - d / 2);
	p4.set(cp[2].x + xDist, cp[2].y - a / 2, cp[2].z + d / 2);
	drawRectAsThinLines(p1, p2, p3, p4);


#ifdef __DISABLED__
	//--- here we create four triangular "patch" planes...these planes are in fact invisible 
	//--- in mesh form (not appended to model space), but when an HLR is done on this element, 
	//--- they are included in the operation...we place them on this element because although 
	//--- the element looks fine as a mesh, the AsdkHlr engine has trouble processing the four 
	//--- triangles that make this mesh...so adding these four triangular planes in the four 
	//--- trouble spots is insurance that we will get accurate hidden line removal
	FdPoint3d centralPoints[6] = { S11, S1, W1, W2, S2, S22 };

	xDist = -(S1[0] - W1[0]) * 2;

	p1.set(S1[0], S1[1] + a / 2, S1[2] - b / 2);
	p2.set(S1[0], S1[1] + a / 2, S1[2] + b / 2);
	p3.set(S1[0] + xDist, S1[1] + a / 2, S1[2] + b / 2);
	p4.set(S1[0] + xDist, S1[1] + a / 2, S1[2] + b / 2);

	makePlane(p1, p2, p3, p4);
	p1.set(S1[0], S1[1] - a / 2, S1[2] - b / 2);
	p2.set(S1[0], S1[1] - a / 2, S1[2] + b / 2);
	p3.set(S1[0] + xDist, S1[1] - a / 2, S1[2] + b / 2);
	p4.set(S1[0] + xDist, S1[1] - a / 2, S1[2] + b / 2);
	makePlane(p1, p2, p3, p4);

	xDist = (S2[0] - W2[0]) * 2;

	p1.set(S2[0], S2[1] + a / 2, S2[2] + d / 2);
	p2.set(S2[0], S2[1] + a / 2, S2[2] - d / 2);
	p3.set(S2[0] - xDist, S2[1] + a / 2, S2[2] - d / 2);
	p4.set(S2[0] - xDist, S2[1] + a / 2, S2[2] - d / 2);
	makePlane(p1, p2, p3, p4);

	p1.set(S2[0], S2[1] - a / 2, S2[2] + d / 2);
	p2.set(S2[0], S2[1] - a / 2, S2[2] - d / 2);
	p3.set(S2[0] - xDist, S2[1] - a / 2, S2[2] - d / 2);
	p4.set(S2[0] - xDist, S2[1] - a / 2, S2[2] - d / 2);
	makePlane(p1, p2, p3, p4);
#endif  // __DISABLED__
}

void GLERectangular :: makeES(double a, double b, double e, double l, double flange_1, double flange_2)
{
	makeEA(a, b, b, e, l, flange_1, flange_2);
}

void GLERectangular :: makeHS(double a, double b, double d, double h, double e, double m, double l, double flange_1, double flange_2, double flange_3)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	/**********************************GEOMETRY*************************************/
	// boxes form the closest one:)
	// first "h" box
	l = l - 2 * fo;
	FdPoint3d p1(-l / 2.0,      0, b / 2.0 - (e + h) / 2.0),
	          p2( l / 2.0,      0, b / 2.0 - e - h / 2.0),
	          p3( l / 2.0 + fo, 0, b / 2.0 - e - h / 2.0);
	FdPoint3d centralPoints[2] = { p2, p3 };
	FdVector3d vectors[2] = { vx, vx };
	FdVector3d upVectors[2] = { vy, vy };
	bool sides[4] = { true, true, true, true };
	double tabWidth[2] = { h, h };
	double tabHeight[2] = { a, a };
	bool edges[3][4] = { true, true, true, true,
	                     true, true, true, true,
	                     true, true, true, true };
	makeBox(1, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, 5, 5, CONNECTOR_SIZE);

	p1.set( l / 2 + fo, 0, b / 2.0 - e - h / 2.0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_3, h + 2 * flange_3);
	makeRectangularFlange(p1, vx, vy, a, h, flange_3);

	p1.set( l / 2, 0, b / 2.0 - e - h / 2.0);
	addSymbolicFlangeRect(p1, vx, vy, a, h);
	drawRectAsThinLines(p1, vx, vy, a, h);

	p1.set( l / 2 + fo, 0, b / 2.0 - e - h / 2.0);
	p2.set( l / 2 + fo, 0, b / 2.0 - e - h / 2.0);
	addCenterLine(p1, p2);

	p1.set( l / 2, 0, b / 2.0 - e - h / 2.0);
	p2.set(-l / 2, 0, b / 4);
	addCenterLine(p1, p2);

	p1.set(-l / 2 - fo, 0, b / 4);
	p2.set(-l / 2,      0, b / 4);
	addCenterLine(p1, p2);

#ifdef __DISABLED__
	//--- there are two lines at the seams where the outer, "Y" boxes meet the inner box, one for each box edge,
	//--- so we must therefore use addEraseLine() twice for each seam
	p1.set(-l / 2, a / 2, b / 2.0 - e - h);
	p2.set( l / 2, a / 2, b / 2.0 - e - h);
	addEraseLine(p1, p2);

	p1.set(-l / 2, -a / 2, b / 2.0 - e - h);
	p2.set( l / 2, -a / 2, b / 2.0 - e - h);
	addEraseLine(p1, p2);

	p1.set(-l / 2, a / 2, b / 2.0 - e - h - m);
	p2.set( l / 2, a / 2, b / 2.0 - e - h - m);
	addEraseLine(p1, p2);

	p1.set(-l / 2, -a / 2, b / 2.0 - e - h - m);
	p2.set( l / 2, -a / 2, b / 2.0 - e - h - m);
	addEraseLine(p1, p2);
#endif

	// the "d" box
	double x = b - e - h - m;
	centralPoints[0].z = b / 2 - e - h - m - d / 2.0;
	centralPoints[1].z = b / 2 - e - h - m - d / 2.0;
	tabWidth[0] = d;
	tabWidth[1] = d;
	makeBox(1, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, 5, 5, CONNECTOR_SIZE);

	p1.set( l / 2 + fo, 0, b / 2 - e - h - m - d / 2.0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_2, d + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, d, flange_2);

	p1.set( l / 2, 0, b / 2 - e - h - m - d / 2.0);
	addSymbolicFlangeRect(p1, vx, vy, a, d);
	drawRectAsThinLines(p1, vx, vy, a, d);

	p1.set( l / 2 + fo, 0, b / 2 - e - h - m - d / 2.0);
	p2.set( l / 2,      0, b / 2 - e - h - m - d / 2.0);
	addCenterLine(p1, p2);

	p1.set( l / 2, 0,  b / 2 - e - h - m - d / 2.0);
	p2.set(-l / 2, 0, -b / 4);
	addCenterLine(p1, p2);

	p1.set(-l / 2 - fo, 0, -b / 4);
	p2.set(-l / 2,      0, -b / 4);
	addCenterLine(p1, p2);

	// left flange
	p1.set(-l / 2.0,      0, 0);
	p2.set(-l / 2.0 - fo, 0, 0);
	FdPoint3d centralPointF[2] = { p1, p2 };
	FdVector3d vectorsF[2] = { vx, vx };
	FdVector3d upVectorsF[2] = { vy, vy };

	double widthF[2] = { a, a };
	double heightF[2] = { b, b };
	bool conF[2] = { false, true };
	bool sidesF[4] = { true, true, true, true };
	bool edgesF[3][4] = { false, false, false, false,
	                      true,  true,  true,  true,
	                      true,  true,  true,  true };
	makeBox(1, centralPointF, vectorsF, upVectorsF, heightF, widthF, sidesF, edgesF, false, false, 5, 5, CONNECTOR_SIZE);

	p1.set(-l / 2 - fo, 0, 0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);

	p1.set(-l / 2, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, a, b);
	drawRectAsThinLines(p1, vx, vy, a, b);

	// drawing all that's inside in a new way :)
	FdPoint3d pi1(-l / 2.0, 0,  b / 2.0),
	          pi2( l / 2.0, 0,  b / 2.0 - e),
	          pi3( l / 2.0, 0,  b / 2.0 - e - h - m - d),
	          pi4(-l / 2.0, 0, -b / 2.0);
	FdPoint3d pc1(-l / 2.0, 0, 0 ), pc2,
	          pc3( l / 2.0, 0, b / 2.0 - e - h / 2.0),
	          pc4( l / 2.0, 0, b / 2.0 - e - h - m - d / 2.0), pc5, pc6;
	FdVector3d v1(pi2 - pi1), v2(pi3 - pi4), v3;
	FdPoint3d pt1(pi1), pt2(pi4);
	pt1 = (pi1 + v1 / 2);
	pt2 = (pi4 + v2 / 2);
	v3 = (pt2 - pt1);
	pc2 = (pt1 + (v3 / 2));
	pc5 = (pt1 + (v3 / 4));
	pc6 = (pt1 + (3 * v3 / 4));

	// first box
	FdPoint3d pi[2] = { pc1, pc2 };
	FdVector3d vi[2] = { vx, vx };
	FdVector3d upVi[2] = { vy, vy };
	bool sidesi[4] = { true, true, true, true };
	double tabWidthi[2] = { b, v3.length() };
	double tabHeighti[2] = { a, a };
	bool edgesi[3][4] = { false, false, false, false,
	                      true,  true,  true,  true,
	                      false, false, false, false };
	makeBox(1, pi, vi, upVi, tabWidthi, tabHeighti, sidesi, edgesi, false, false, 5, 5, CONNECTOR_SIZE);

	addEraseRect(pc2, vx, vy, a, v3.length(), sidesi);

	// lower box
	pi[0] = pc5;
	pi[1] = pc3;
	tabWidthi[0] = v3.length() / 2;  tabWidthi[1] = h;
	makeBox(1, pi, vi, upVi, tabWidthi, tabHeighti, sidesi, edgesi, false, false, 5, 5, CONNECTOR_SIZE);

	// upper box
	pi[0] = pc6;
	pi[1] = pc4;
	tabWidthi[0] = v3.length() / 2;  tabWidthi[1] =  d;
	makeBox(1, pi, vi, upVi, tabWidthi, tabHeighti, sidesi, edgesi, false, false, 5, 5, CONNECTOR_SIZE);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyd = d, copyh = h, copye = e, copym = m, copyl = l;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		b += 2 * size;  h += 2 * size;  d += 2 * size;  a += 2 * size;
		m -= 2 * size;

		FdPoint3d p1(-l / 2.0,      0, b / 2.0 - (e + h) / 2.0),
		          p2( l / 2.0,      0, b / 2.0 - e - h / 2.0),
		          p3( l / 2.0 + fo, 0, b / 2.0 - e - h / 2.0);
		FdPoint3d centralPoints[2] = { p2, p3 };
		FdVector3d vectors[2] = { vx, vx };
		FdVector3d upVectors[2] = { vy, vy };
		bool sides[4] = { true, true, true, true };
		double tabWidth[2] = { h, h };
		double tabHeight[2] = { a, a };
		bool edges[3][4] = { true, true, true, true,
		                     true, true, true, true,
		                     true, true, true, true };
		makeBox(1, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, 5, (size > flange_3) ? 0 : 5, flange_3 - size);

		double x = b - e - h - m;
		centralPoints[0].z = b / 2 - e - h - m - d / 2.0;
		centralPoints[1].z = b / 2 - e - h - m - d / 2.0;
		tabWidth[0] = d;
		tabWidth[1] = d;
		makeBox(1, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, 5, (size > flange_2) ? 0 : 5, flange_2 - size);


		// left flange
		p1.set(-l / 2.0,    0, 0);
		p2.set(-l / 2 - fo, 0, 0);
		FdPoint3d centralPointF[2] = { p1, p2 };
		// FdVector3d vectorsF[2] = { vx, vx };
		// FdVector3d upVectorsF[2] = { vy, vy };

		double widthF[2] = { a, a };
		double heightF[2] = { b, b };
		// bool conF[2] = { false, true };
		bool sidesF[4] = { true, true, true, true };
		// bool edgesF[3][4] = { false, false, false, false,
		//                       true,  true,  true,  true,
		//                       true,  true,  true,  true };
		makeBox(1, centralPointF, vectors, upVectors, heightF, widthF, sidesF, false, false, 5, (size > flange_1) ? 0 : 5, flange_1 - size);

		// drawing all that's inside in a new way :)
		FdPoint3d pi1(-l / 2.0, 0,  b / 2.0),
		          pi2( l / 2.0, 0,  b / 2.0 - e),
		          pi3( l / 2.0, 0,  b / 2.0 - e - h - m - d),
		          pi4(-l / 2.0, 0, -b / 2.0); 
		FdPoint3d pc1(-l / 2.0, 0,  0), pc2,
		          pc3( l / 2.0, 0,  b / 2.0 - e - h / 2),
		          pc4( l / 2.0, 0,  b / 2.0 - e - h - m - d / 2), pc5, pc6;
		FdVector3d v1(pi2 - pi1), v2(pi3 - pi4), v3;
		FdPoint3d pt1(pi1), pt2(pi4);
		FdVector3d sizev(size, 0, 0);
		pt1 = (pi1 + v1 / 2 + sizev); 
		pt2 = (pi4 + v2 / 2 + sizev);
		v3 = (pt2 - pt1);
		pc2 = (pt1 + (v3 / 2));
		pc5 = (pt1 + (v3 / 4));
		pc6 = (pt1 + (3 * v3 / 4));

		// first box
		FdPoint3d pi[2] = { pc1, pc2 };
		FdVector3d vi[2] = { vx, vx };
		FdVector3d upVi[2] = { vy, vy };
		bool sidesi[4] = { true, true, true, true };
		double tabWidthi[2] = { b, v3.length() };
		double tabHeighti[2] = { a, a };
		bool edgesi[3][4] = { false, false, false, false,
		                      true,  true,  true,  true,
		                      false, false, false, false };
		makeBox(1, pi, vi, upVi, tabWidthi, tabHeighti, sidesi, edgesi, false, false, 5, (size > flange_1) ? 0 : 5, flange_1 - size);

		addEraseRect(pc2, vx, vy, a, v3.length(), sidesi);

		// lower box
		pi[0] = pc5;
		pi[1] = pc3;
		tabWidthi[0] = v3.length() / 2;  tabWidthi[1] = h;
		makeBox(1, pi, vi, upVi, tabWidthi, tabHeighti, sidesi, edgesi, false, false, 5, (size > flange_3) ? 0 : 5, flange_3 - size);

		// upper box
		pi[0] = pc6;
		pi[1] = pc4;
		tabWidthi[0] = v3.length() / 2;  tabWidthi[1] = d;
		makeBox(1, pi, vi, upVi, tabWidthi, tabHeighti, sidesi, edgesi, false, false, 5, (size > flange_2) ? 0 : 5, flange_2 - size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  h = copyh;  e = copye;  m = copym;  l = copyl;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		b -= 2 * size;  h -= 2 * size;  d -= 2 * size;  a -= 2 * size;
		m += 2 * size;

		FdPoint3d p1(-l / 2.0,      0, b / 2.0 - (e + h) / 2.0),
		          p2( l / 2.0,      0, b / 2.0 - e - h / 2.0),
		          p3( l / 2.0 + fo, 0, b / 2.0 - e - h / 2.0);
		FdPoint3d centralPoints[2] = { p2, p3 };
		FdVector3d vectors[2] = { vx, vx };
		FdVector3d upVectors[2] = { vy, vy };
		bool sides[4] = { true, true, true, true };
		double tabWidth[2] = { h, h };
		double tabHeight[2] = { a, a };
		bool edges[3][4] = { true, true, true, true,
		                     true, true, true, true,
		                     true, true, true, true };
		makeBox(1, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, 5, 0, size);

		double x = b - e - h - m;
		centralPoints[0].z = b / 2 - e - h - m - d / 2.0;
		centralPoints[1].z = b / 2 - e - h - m - d / 2.0;
		tabWidth[0] = d;
		tabWidth[1] = d;
		makeBox(1, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, 5, 0, size);

		// left flange
		p1.set(-l / 2.0,    0, 0);
		p2.set(-l / 2 - fo, 0, 0);
		FdPoint3d centralPointF[2] = { p1, p2 };
		FdVector3d vectorsF[2] = { vx, vx };
		FdVector3d upVectorsF[2] = { vy, vy };

		double widthF[2] = { a, a };
		double heightF[2] = { b, b };
		// bool conF[2] = { false, true };
		bool sidesF[4] = { true, true, true, true };
		bool edgesF[3][4] = { false, false, false, false,
		                      true,  true,  true,  true,
		                      true,  true,  true,  true };

		makeBox(1, centralPointF, vectorsF, upVectorsF, heightF, widthF, sidesF, edgesF, false, false, 5, 0, size);


		// drawing all that's inside in a new way :)
		FdPoint3d pi1(-l / 2.0, 0,  b / 2.0),
		          pi2( l / 2.0, 0,  b / 2.0 - e),
		          pi3( l / 2.0, 0,  b / 2.0 - e - h - m - d),
		          pi4(-l / 2.0, 0, -b / 2.0);
		FdPoint3d pc1(-l / 2.0, 0, 0 ), pc2,
		          pc3( l / 2.0, 0, b / 2.0 - e - h / 2),
		          pc4( l / 2.0, 0, b / 2.0 - e - h - m - d / 2), pc5, pc6;
		FdVector3d v1(pi2 - pi1), v2(pi3 - pi4), v3;
		FdPoint3d pt1(pi1), pt2(pi4);
		FdVector3d sizev(size, 0, 0);
		pt1 = (pi1 + v1 / 2 - sizev);
		pt2 = (pi4 + v2 / 2 - sizev);
		v3 = (pt2 - pt1);
		pc2 = (pt1 + (v3 / 2));
		pc5 = (pt1 + (v3 / 4));
		pc6 = (pt1 + (3 * v3 / 4));
				
		// first box
		FdPoint3d pi[2] = { pc1, pc2 };
		FdVector3d vi[2] = { vx, vx };
		FdVector3d upVi[2] = { vy, vy };
		bool sidesi[4] = { true, true, true, true };
		double tabWidthi[2] = { b, v3.length() };
		double tabHeighti[2] = { a, a };
		bool edgesi[3][4] = { false, false, false, false,
		                      true,  true,  true,  true,
		                      false, false, false, false };
		makeBox(1, pi, vi, upVi, tabWidthi, tabHeighti, sidesi, edgesi, false, false, 5, 5, flange_1);

		addEraseRect(pc2, vx, vy, b, a, sidesi);

		// lower box
		pi[0] = pc5;
		pi[1] = pc3;
		tabWidthi[0] = v3.length() / 2;  tabWidthi[1] = h;
		makeBox(1, pi, vi, upVi, tabWidthi, tabHeighti, sidesi, edgesi, false, false, 5, 5, flange_3);

		// upper box
		pi[0] = pc6;
		pi[1] = pc4;
		tabWidthi[0] = v3.length() / 2;  tabWidthi[1] = d;
		makeBox(1, pi, vi, upVi, tabWidthi, tabHeighti, sidesi, edgesi, false, false, 5, 5, flange_2);
	}
}

void GLERectangular :: makeK(double a, double b, double l, double flange_1, double flange_2)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	/**********************************GEOMETRY*************************************/
	FdPoint3d p1(-l / 2.0, 0, 0),
	          p2( l / 2.0, 0, 0);
	FdPoint3d cp[2] = { p1, p2 };
	FdVector3d v[2] = { vx, vx };
	FdVector3d upv[2] = { vy, vy };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	bool sides[4] = { true, true, true, true };
	int flange = (flange_1 == flange_2) ? 0 : 5;
	makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, false, flange, flange, flange_1);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyl = l;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		a += 2 * size;
		b += 2 * size;

		FdPoint3d p1(-l / 2.0, 0, 0),
		          p2( l / 2.0, 0, 0);
		FdPoint3d cp[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabWidth[2] = { b, b };
		double tabHeight[2] = { a, a };
		bool sides[4] = { true, true, true, true };

		int flange_size = flange_1 - size;
		int flange1 = (size > flange_1) ? 0 : 5;
		int flange2 = (size > flange_2) ? 0 : 5;
		if( flange_1 != flange_2 )
		{
			if( size > flange_1 && size > flange_2 )
				flange1 = flange2 = 5;
			else if( size > flange_2 )
				flange_size = flange_2 - size;
		}
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, false, flange1, flange2, flange_size);

		if( flange_1 != flange_2 && size > flange_1 && size > flange_2 )
		{
			makeRectangularFlange(p1, vx, vy, a - 2 * size + 2 * flange_1, b - 2 * size + 2 * flange_1, size - flange_1);
			makeRectangularFlange(p2, vx, vy, a - 2 * size + 2 * flange_2, b - 2 * size + 2 * flange_2, size - flange_2);
		}
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  l = copyl;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		a -= 2 * size;
		b -= 2 * size;

		FdPoint3d p1(-l / 2.0, 0, 0),
		          p2( l / 2.0, 0, 0);
		FdPoint3d cp[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabWidth[2] = { b, b };
		double tabHeight[2] = { a, a };
		bool sides[4] = { true, true, true, true };
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, false, 0, 0, size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  l = copyl;
	setPrimitiveMode(FLM3Geo::pmNormal);

	//--- specify lines that should be drawn as thin
	p1.set(-l / 2 + fo, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, a, b);
	p1.set( l / 2 - fo, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, a, b);

	//--- specify two rectangular connectors
	p1.set(-l / 2, 0, 0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	p2.set( l / 2, 0, 0);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);

	if( flange_1 != flange_2 )
	{
		makeRectangularFlange(p1, vx, vy, a, b, flange_1);
		makeRectangularFlange(p2, vx, vy, a, b, flange_2);
	}

	//--- add the center lines for...
	// for the duct axis
	addCenterLine(p1, p2);
}

void GLERectangular :: makeRA(double height, double width, double diam1, double length1, double length2, double e, double f, double flange1, double flange2, int n, double flange_1)
{
	/**********************************GEOMETRY*************************************/
	//---rect to circ transition...the connecting tube is not drawn by the function
	//---(it's length is given as 0), because of gouraud shading issues
	FdPoint3d p1(-length1 / 2 + flange1, 0, 0), p2,
	          ts( length1 / 2 - length2, (width / 2 - diam1 / 2) + e, (height / 2 - diam1 / 2) + f);
	double heightWidth[2] = { width, height };
	double tubeParams[3] = { diam1, diam1, 0 };
	makeRectToTubeTransition(p1, vx, vy, heightWidth, ts, tubeParams, n);

	//---draw the conecting tube
	FdPoint3d te = ts;  te.x += length2;
	makeVerySimpleTube(ts, te, diam1, n);

	p1.set(-length1 / 2,           0, 0);
	p2.set(-length1 / 2 + flange1, 0, 0);
	FdPoint3d cp[2] = { p1, p2 };
	double tabWidth[2] = { height, height };
	double tabHeight[2]= { width, width };
	FdVector3d v[2] = { vx, vx };
	FdVector3d upv[2] = { vy, vy };
	bool sides[4] = { true, true, true, true };
	makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, false, 0, 5, flange_1);

	/****************************Copy/create Insulation vairables*******************/
	double copyheight = height, copywidth = width, copydiam1 = diam1, copylength1 = length1,
	       copylength2 = length2, copye = e, copyf = f, copyflange1 = flange1, copyflange2 = flange2;
	
	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		height += 2 * size; width += 2 * size;
		diam1  += 2 * size; 

		FdPoint3d p1(-length1/2+flange1, 0, 0),	p2,
			ts(length1/2-length2, (width/2-diam1/2)+e, (height/2-diam1/2)+f);
		double heightWidth[2] = {width, height};
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vx, vy, heightWidth, ts, tubeParams, n);

		//---draw the conecting tube
		FdPoint3d te = ts; te.x += length2;
		makeVerySimpleTube(ts, te, diam1, n);
		
		//this should be skipped in HLR
		makeFlatRing(te, vx, diam1 - 2 * size, diam1, n);

		p1.set(-length1/2, 0, 0), p2.set(-length1/2 + flange1, 0, 0);
		FdPoint3d cp[2] = {p1, p2};
		FdVector3d v[2] = {vx,vx};
		FdVector3d upv[2] = {vy,vy};
		double tabWidth[2] = { height, height };
		double tabHeight[2]= { width, width };
		bool sides[4]={ true, true, true, true };
		bool con[2] = { true, false };  // true means draw, false means not to. {first connector, second connector}
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, false, (size > flange_1) ? 0 : 5, 5, flange_1 - size);
	}

	/**********************************Recover variables*******************************/
	height = copyheight;  width = copywidth;  diam1 = copydiam1;  length1 = copylength1;
	length2 = copylength2;  e = copye;  f = copyf;  flange1 = copyflange1;  flange2 = copyflange2;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		height -= 2 * size; width -= 2 * size;
		diam1  -= 2 * size; 

		FdPoint3d p1(-length1/2+flange1, 0, 0),	p2,
			ts(length1/2-length2, (width/2-diam1/2)+e, (height/2-diam1/2)+f);
		double heightWidth[2] = {width, height};
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vx, vy, heightWidth, ts, tubeParams, n);

		//---draw the conecting tube
		FdPoint3d te = ts; te.x += length2;
		makeVerySimpleTube(ts, te, diam1, n);
		
		//this should be skipped in HLR
		makeFlatRing(te, vx, diam1, diam1 + 2 * size, n);

		p1.set(-length1/2, 0, 0), p2.set(-length1/2 + flange1, 0, 0);
		FdPoint3d cp[2] = {p1, p2};
		FdVector3d v[2] = {vx,vx};
		FdVector3d upv[2] = {vy,vy};
		double tabWidth[2] = { height, height };
		double tabHeight[2]= { width, width };
		bool sides[4]={ true, true, true, true };
		bool con[2] = { true, false };  // true means draw, false means not to. {first connector, second connector}
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, false, 0, 5, size);
	}

	/**********************************Recover variables*******************************/
	height = copyheight;  width = copywidth;  diam1 = copydiam1;  length1 = copylength1;
	length2 = copylength2;  e = copye;  f = copyf;  flange1 = copyflange1;  flange2 = copyflange2;
	setPrimitiveMode(FLM3Geo::pmNormal);

	//---specify a circular connector
	p1.set(length1/2, (width/2-diam1/2)+e, (height/2-diam1/2)+f);
	addCircularConnector(p1);

	//---specify a rectangular connector
	p1.set(-length1/2, 0, 0);
	p2.set(-length1/2+flange1, 0, 0);
	addRectangularConnector(p1, vx, vy, width + 2 * flange_1, height + 2 * flange_1);
	addSymbolicFlangeRect(p2, vx, vy, width, height);

	//---specify lines that should be drawn as thin
	drawAsThinArc(ts);
	
	p1.set(-length1/2 + flange1,0,0);
	drawRectAsThinLines(p1, vx, vy, width, height);

	//---the eight lines resulting from the cone sections should also be thin
	p1.set(ts.x, ts.y + diam1/2, ts.z);
	p2.set(-length1/2 + flange1,  width/2,  height/2);
	drawAsThinLine(p1, p2);
	
	p1.set(ts.x, ts.y, ts.z + diam1/2);
	p2.set(-length1/2 + flange1,  width/2,  height/2);
	drawAsThinLine(p1, p2);
	
	p1.set(ts.x, ts.y, ts.z + diam1/2);
	p2.set(-length1/2 + flange1, -width/2,  height/2);
	drawAsThinLine(p1, p2);
	
	p1.set(ts.x, ts.y - diam1/2, ts.z);
	p2.set(-length1/2 + flange1, -width/2,  height/2);
	drawAsThinLine(p1, p2);
	
	p1.set(ts.x, ts.y - diam1/2, ts.z);
	p2.set(-length1/2 + flange1, -width/2, -height/2);
	drawAsThinLine(p1, p2);
	
	p1.set(ts.x, ts.y, ts.z - diam1/2);
	p2.set(-length1/2 + flange1, -width/2, -height/2);
	drawAsThinLine(p1, p2);
	
	p1.set(ts.x, ts.y, ts.z - diam1/2);
	p2.set(-length1/2 + flange1,  width/2, -height/2);
	drawAsThinLine(p1, p2);
	
	p1.set(ts.x, ts.y + diam1/2, ts.z);
	p2.set(-length1/2 + flange1,  width/2, -height/2);
	drawAsThinLine(p1, p2);
		
	//---add center lines
	addCenterLine(cp[0], cp[1]);
	addCenterLine(cp[1], ts);
	p1.set(ts.x+length2, ts.y, ts.z);
	addCenterLine(ts, p1);
}

void GLERectangular :: makeTA(double a, double b, double d, double h, double e, double f, double r, double m, double l, double n, double flange_1, double flange_2, double flange_3)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	l = l - 2 * fo;
	f = f - fo;
	e = e - fo;

	/**********************************GEOMETRY*************************************/

	double x = e + d + m;

	FdPoint3d p1, p2;
	// left offside ISC
	p1.set(-l / 2.0 - fo, 0, (b - x - fo) / 2.0);
	p2.set(-l / 2.0,      0, (b - x - fo) / 2.0);
	FdPoint3d cp[2] = { p1, p2 };
	FdVector3d vecLOB[2] = { vx, vx };
	double tabWidthLOB[2] = { b, b };
	double tabHeightLOB[2]= { a, a };
	bool sides[4] = { true, true, true, true };
	bool edgesLOB[3][4] = { true,  true,  true,  true,
	                        true,  true,  true,  true,
	                        false, false, false, false };
	bool conLOB[2] = { false, false };
	makeBox(1, cp, vecLOB, tabWidthLOB, tabHeightLOB, sides, edgesLOB, conLOB, false, false);

	// right offside ISC
	p1.set( l / 2.0 + fo, 0, (d - x - fo) / 2.0 + m);
	p2.set( l / 2.0,      0, (d - x - fo) / 2.0 + m);
	cp[0] = p1;  cp[1] = p2;
	FdVector3d vecROB[2] = { vx, vx };
	double tabWidthROB[2] = { d, d };
	double tabHeightROB[2] = { a, a };
	bool conROB[2] = { false, false };
	bool edgesROB[3][4] = { true,  true,  true,  true,
	                        true,  true,  true,  true,
	                        false, false, false, false };
	makeBox(1, cp, vecROB, tabWidthROB, tabHeightROB, sides, edgesLOB, conROB, false, false);

	// far box
	p1.set(-l / 2.0, 0,  (m - x - fo) / 2.0 + d / 4.0);
	p2.set( l / 2.0, 0, -(x + fo) / 2.0 + m + d / 4.0);
	cp[0] = p1;  cp[1] = p2;
	double tabWidth[2] = { (m + d / 2.0), d / 2.0 };
	double tabHeight[2]= { a, a };
	FdVector3d v[2] = { vx, vx };
	sides[1] = false;
	bool con[2] = { false, false };
	bool edges[3][4] = { false, false, false, true,
	                     true,  false, false, true,
	                     false, false, false, true };
	makeBox(1, cp, v, tabWidth, tabHeight, sides, edges, con, false, false);

	// left bend
	p1.set(-l / 2.0 + f - r, 0, -(x + fo) / 2.0 + b - d / 4.0);
	bool sidesL[4] = { true, false, true, false };
	makeRectBend(p1, vx, vy, sidesL,  true, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);
	bool sidesL2[4] = { false, true, false, false };
	makeRectBend(p1, vx, vy, sidesL2, true, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);

	// right bend
	p1.set(-l / 2.0 + f + h + r, 0, -(x + fo) / 2.0 + m + 3.0 / 4.0 * d);
	makeRectBend(p1, vx, vy, sidesL,  false, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);
	makeRectBend(p1, vx, vy, sidesL2, false, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);

	// left box
	if( (f - r) > 0 )
	{
		p1.set(-l / 2.0,         0, -x / 2.0 + (b + m + d - fo) / 2.0 - d / 4.0);
		p2.set(-l / 2.0 + f - r, 0, -x / 2.0 + (b + m + d - fo) / 2.0 - d / 4.0);
		cp[0] = p1;  cp[1] = p2;

		v[0] = vx;  v[1] = vx;
		double tabWidthLB[2] = { b - m - d / 2.0, b - m - d / 2.0 };
		double tabHeightLB[2] = { a, a };
		bool sidesLB[4] = { true, true, true, false };
		bool conLB[2] = { false, false };
		bool edgesLB[3][4] = { false, false, false, false,
		                       false, true,  true,  false,
		                       false, false, false, false };
		makeBox(1, cp, v, tabWidthLB, tabHeightLB, sidesLB, edgesLB, conLB, false, false);

		bool eraseSides[4] = { false, true, false, true };
		p1.set(-l / 2.0 + (f - r), 0, -x / 2.0 + (b - (m + d / 2.0)) / 2.0 + m + d / 2.0 - fo / 2);
		addEraseRect(p1, vx, -vz, b - m - d / 2.0, a, eraseSides);

		eraseSides[0] = true;  eraseSides[1] = false;  eraseSides[2] = true;  eraseSides[3] = false;
		p1.set(-l / 2.0 + (f - r), 0, -x / 2.0 + (b - (m + d / 2.0)) / 2.0 + m + d / 2.0 - fo / 2);
		addEraseRect(p1, vx, -vz, b - m - d / 2.0, a, -vz, eraseSides);
	}

	// right box
	if( (f + h + r) < l )
	{
		p1.set(-l / 2.0 + f + h + r, 0, -(x + fo) / 2.0 + m + 3.0 / 4.0 * d);
		p2.set( l / 2.0,             0, -(x + fo) / 2.0 + m + 3.0 / 4.0 * d);
		cp[0] = p1;  cp[1] = p2;

		v[0] = vx;  v[1] = vx;
		double tabWidthRB[2] = { d / 2.0, d / 2.0 };
		double tabHeightRB[2] = { a, a };
		bool sidesRB[4] = { true, true, true, false };
		bool conRB[2] = { false, false };
		bool edgesRB[3][4] = { false, false, false, false,
		                       false, true,  true,  false,
		                       false, false, false, false };
		makeBox(1, cp, v, tabWidthRB, tabHeightRB, sidesRB, edgesRB, conRB, false, false);

		bool eraseSides[4] = { false, true, false, true };
		p1.set(-l / 2.0 + f + h + r, 0, -x / 2.0 + m + 3.0 / 4.0 * d - fo / 2);
		addEraseRect(p1, vx, -vz, d / 2, a, eraseSides);

		eraseSides[0] = true;  eraseSides[1] = false;  eraseSides[2] = true;  eraseSides[3] = false;
		p1.set(-l / 2.0 + f + h + r, 0, -x / 2.0 + m + 3.0 / 4.0 * d - fo / 2);
		addEraseRect(p1, vx, -vz, d / 2, a, -vz, eraseSides);
	}

	// inside box
	p1.set(-l / 2.0 + f - r,       0, -x / 2.0 + m + (b - m - fo) / 2.0);
	p2.set(-l / 2.0 + f + h / 2.0, 0, -x / 2.0 + m + (b - m - fo) / 2.0);
	cp[0] = p1;  cp[1] = p2;

	v[0] = vx;  v[1] = vx;
	double tabWidthIB[2] = { b - m - d, b - m - d };
	double tabHeightIB[2] = { a, a };
	bool sidesIB[4] = { true, false, true, false };
	bool conIB[2] = { false, false };
	bool edgesIB[3][4] = { false, false, false, false,
	                       false, false, false, false,
	                       true,  false, true,  false };
	makeBox(1, cp, v, tabWidthIB, tabHeightIB, sidesIB, edgesIB, conIB, false, false);

	bool eraseSidesIB[4] = { true, true, true, true };
	p1.set(-l / 2.0 + f - r + (h / 2 + r) / 2, 0, -x / 2.0 + m + d / 2.0 + (b - (d / 2.0 + m + d / 2.0)) / 2.0 + (b - m - d) / 2 - fo / 2);
	addEraseRect(p1, vz, vy, a, h / 2 + r, eraseSidesIB);

	// right closer box
	if( (e - r) > 0 )
	{
		p1.set(-l / 2.0 + f + h / 2.0, 0, -x / 2.0 + r + (b + m + d - fo) / 2.0);
		p2.set(-l / 2.0 + f + h,       0, -x / 2.0 + r + (b + m + d - fo) / 2.0);
		cp[0] = p1;  cp[1] = p2;
	
		double tabWidthRCB[2] = { b - m - d, b - m - d };
		double tabHeightRCB[2] = { a, a };
		bool sidesRCB[4] = { true, false, true, false };
		bool conRCB[2] = { false, false };
		makeBox(1, cp, tabWidthRCB, tabHeightRCB, sidesRCB, conRCB, false, true);

		bool eraseSides[4] = { true, true, true, true };
		p1.set(-l / 2.0 + f + h / 2 + h / 4, 0, -x / 2 + m + d + r - fo / 2);
		addEraseRect(p1, vz, vy, a, h / 2, eraseSides);
	}

	// the closest box - right in front of us - ISC
	if( x > b + r )
	{
		p1.set(-l / 2.0 + f + h / 2.0, 0,  (x - fo) / 2.0);
		p2.set(-l / 2.0 + f + h / 2.0, 0, -(x + fo) / 2.0 + b + r);
		cp[0] = p1;  cp[1] = p2;

		v[0] = vz;  v[1] = vz;
		double tabWidthRCB[2] = { a, a };  // remember how perpVector works!!!
		double tabHeightRCB[2] = { h, h };
		bool sidesRCB[4] = { true, true, true, true };
		bool conRCB[2] = { false, false };
		bool edgesRCB[3][4] = { false, false, false, false,
		                        true,  true,  true,  true,
		                        false, false, false, false };
		makeBox(1, cp, v, tabWidthRCB, tabHeightRCB, sidesRCB, edgesRCB, conRCB, false, false);

		bool eraseSides[4] = { true, true, true, true };

		p1.set(-l / 2.0 + f + h / 2, 0, -x / 2 + b + r - fo / 2);
		addEraseRect(p1, vz, vy, a, h, eraseSides);		
	}

	// front flange box
	p1.set(-l / 2.0 + f + h /2.0, 0, (x - fo) / 2.0 + fo);
	p2.set(-l / 2.0 + f + h /2.0, 0, (x - fo) / 2.0);
	cp[0] = p1;  cp[1] = p2;

	FdVector3d vecFFB[2] = { vz, vz };
	double tabWidthFFB[2] = { a, a };  // remember how perpVector works!!!
	double tabHeightFFB[2] = { h, h };
	bool sidesFFB[4] = { true, true, true, true };
	bool conFFB[2] = { false, false };
	bool edgesFFB[3][4] = { true,  true,  true,  true,
	                        true,  true,  true,  true,
	                        false, false, false, false };
	makeBox(1, cp, vecFFB, tabWidthFFB, tabHeightFFB, sidesFFB, edgesFFB, conFFB, false, false);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyd = d, copyh = h, copye = e, copyf = f, copyr = r, copym = m, copyl = l;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		if( size >= r )
			{  size = r - 0.1;  };

		b += 2 * size;  d += 2 * size;  h += 2 * size;  a += 2 * size;
		f -= size;  e -= size;  m -= size;  r -= size;

		double x = e + d + m;

		FdPoint3d p1, p2;
		// left offside ISC
		p1.set(-l / 2.0 - fo, 0, (b - x - fo) / 2.0 - size);
		p2.set(-l / 2.0,      0, (b - x - fo) / 2.0 - size);
		FdPoint3d cp[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabWidthLOB[2] = { b, b };
		double tabHeightLOB[2] = { a, a };
		bool sides[4] = { true, true, true, true };
		makeBox(1, cp, v, upv, tabWidthLOB, tabHeightLOB, sides, false, false, (size > flange_1) ? 0 : 5, 5, flange_1 - size);

		// right offside ISC
		p1.set( l / 2.0 + fo, 0, (d - x - fo) / 2.0 + m);
		p2.set( l / 2.0,      0, (d - x - fo) / 2.0 + m);
		cp[0] = p1;  cp[1] = p2;
		double tabWidthROB[2] = { d, d };
		double tabHeightROB[2] = { a, a };
		makeBox(1, cp, v, upv, tabWidthROB, tabHeightROB, sides, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);

		// far box
		p1.set(-l / 2.0, 0, (m - x - fo) / 2.0 + d / 4.0 - size / 2);
		p2.set( l / 2.0, 0, -(x + fo) / 2.0 + m + d / 4.0);
		cp[0] = p1;  cp[1] = p2;
		double tabWidth[2] = { (m + d / 2.0) + size, d / 2.0 };
		double tabHeight[2] = { a, a };
		sides[1] = false;
		bool con[2] = { false, false };
		bool edges[3][4] = { true, true,  true,  true,
		                     true, false, false, true,
		                     true, true,  true,  true };
		makeBox(1, cp, v, tabWidth, tabHeight, sides, edges, con, false, false);

		// left bend
		p1.set(-l / 2.0 + f - r, 0, -(x + fo) / 2.0 + b - d / 4.0  - size);
		bool sidesL[4] = { true, false, true, false };
		makeRectBend(p1, vx, vy, sidesL,  true, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);
		bool sidesL2[4] = { false, true, false, false };
		makeRectBend(p1, vx, vy, sidesL2, true, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);

		// right bend
		p1.set(-l / 2.0 + f + h + r, 0, -(x + fo) / 2.0 + m + 3.0 / 4.0 * d);
		makeRectBend(p1, vx, vy, sidesL,  false, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);
		makeRectBend(p1, vx, vy, sidesL2, false, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);

		// left box
		if( (f - r) > 0 )
		{
			p1.set(-l / 2.0,         0, -x / 2.0 + (b + m + d - fo) / 2.0 - d / 4.0 - size / 2);
			p2.set(-l / 2.0 + f - r, 0, -x / 2.0 + (b + m + d - fo) / 2.0 - d / 4.0 - size / 2);
			cp[0] = p1;  cp[1] = p2;

			v[0] = vx;  v[1] = vx;
			double tabWidthLB[2] = { b - m - d / 2.0 - size, b - m - d / 2.0 - size };
			double tabHeightLB[2] = { a, a };
			bool sidesLB[4] = { true, true, true, false };
			bool conLB[2] = { false,false };
			bool edgesLB[3][4] = { false, false, false, false,
			                       false, true,  true,  false,
			                       false, false, false, false };
			makeBox(1, cp, v, tabWidthLB, tabHeightLB, sidesLB, edgesLB, conLB, false, false);

			bool eraseSides[4] = { false, true, false, true };
			p1.set(-l / 2.0 + (f - r), 0, -x / 2.0 + (b - (m + d / 2.0)) / 2.0 + m + d / 2.0 - fo / 2);
			addEraseRect(p1, vx, -vz, b - m - d / 2.0, a, eraseSides);

			eraseSides[0] = true;  eraseSides[1] = false;  eraseSides[2] = true;  eraseSides[3] = false;
			p1.set(-l / 2.0 + (f - r), 0, -x / 2.0 + (b - (m + d / 2.0)) / 2.0 + m + d / 2.0 - fo / 2);
			addEraseRect(p1, vx, -vz, b - m - d / 2.0, a, -vz, eraseSides);
		}

		// right box
		if( (f + h + r) < l )
		{
			p1.set(-l / 2.0 + f + h + r, 0, -(x + fo) / 2.0 + m + 3.0 / 4.0 * d);
			p2.set( l / 2.0,             0, -(x + fo) / 2.0 + m + 3.0 / 4.0 * d);
			cp[0] = p1;  cp[1] = p2;

			v[0] = vx;  v[1] = vx;
			double tabWidthRB[2] = { d / 2.0, d / 2.0 };
			double tabHeightRB[2] = { a, a };
			bool sidesRB[4] = { true, true, true, false };
			bool conRB[2] = { false, false };
			bool edgesRB[3][4] = { false, false, false, false,
			                       false, true,  true,  false,
			                       false, false, false, false };
			makeBox(1, cp, v, tabWidthRB, tabHeightRB, sidesRB, edgesRB, conRB, false, false);

			bool eraseSides[4] = { false, true, false, true };
			p1.set(-l / 2.0 + f + h + r, 0, -x / 2.0 + m + 3.0 / 4.0 * d - fo / 2);
			addEraseRect(p1, vx, -vz, d / 2, a, eraseSides);

			eraseSides[0] = true;  eraseSides[1] = false;  eraseSides[2] = true;  eraseSides[3] = false;
			p1.set(-l / 2.0 + f + h + r, 0, -x / 2.0 + m + 3.0 / 4.0 * d - fo / 2);
			addEraseRect(p1, vx, -vz, d / 2, a, -vz, eraseSides);
		}

		// inside box
		p1.set(-l / 2.0 + f - r,       0, -x / 2.0 + m + (b - m - fo) / 2.0 - size / 2);
		p2.set(-l / 2.0 + f + h / 2.0, 0, -x / 2.0 + m + (b - m - fo) / 2.0 - size / 2);
		cp[0] = p1;  cp[1] = p2;

		v[0] = vx;  v[1] = vx;
		double tabWidthIB[2] = { b - m - d - size, b - m - d - size };
		double tabHeightIB[2] = { a, a };
		bool sidesIB[4] = { true, false, true, false };
		bool conIB[2] = { false, false };
		bool edgesIB[3][4] = { false, false, false, false,
		                       false, false, false, false,
		                       true,  false, true,  false };
		makeBox(1, cp, v, tabWidthIB, tabHeightIB, sidesIB, edgesIB, conIB, false, false);

		bool eraseSidesIB[4] = { true, true, true, true };
		p1.set(-l / 2.0 + f - r + (h / 2 + r) / 2, 0, -x / 2.0 + m + d / 2.0 + (b - (d / 2.0 + m + d / 2.0)) / 2.0 + (b - m - d) / 2 - fo / 2);
		addEraseRect(p1, vz, vy, a, h / 2 + r, eraseSidesIB);

		// right closer box
		if( (e - r) > 0 )
		{
			p1.set(-l / 2.0 + f + h / 2.0, 0, -x / 2.0 + r + (b + m + d - fo) / 2.0 - size / 2);
			p2.set(-l / 2.0 + f + h,       0, -x / 2.0 + r + (b + m + d - fo) / 2.0 - size / 2);
			cp[0] = p1;  cp[1] = p2;

			double tabWidthRCB[2] = { b - m - d - size, b - m - d - size };
			double tabHeightRCB[2] = { a, a };
			bool sidesRCB[4] = { true, false, true, false };
			bool conRCB[2] = { false, false };
			makeBox(1, cp, tabWidthRCB, tabHeightRCB, sidesRCB, conRCB, false, true);

			bool eraseSides[4] = { true, true, true, true };
			p1.set(-l / 2.0 + f + h / 2 + h / 4, 0, -x / 2 + m + d + r - fo / 2);
			addEraseRect(p1, vz, vy, a, h / 2, eraseSides);
		}

		// the closest box - right in front of us - ISC
		if( x > b + r )
		{
			p1.set(-l / 2.0 + f + h / 2.0, 0,  (x - fo) / 2.0);
			p2.set(-l / 2.0 + f + h / 2.0, 0, -(x + fo) / 2.0 + b + r);
			cp[0] = p1;  cp[1] = p2;

			v[0] = vz;  v[1] = vz;
			double tabWidthRCB[2] = { a, a };  // remember how perpVector works!!!
			double tabHeightRCB[2] = { h, h };
			bool sidesRCB[4] = { true, true, true, true };
			bool conRCB[2] = { false, false };
			bool edgesRCB[3][4] = { false, false, false, false,
			                        true,  true,  true,  true,
			                        false, false, false, false };
			makeBox(1, cp, v, tabWidthRCB, tabHeightRCB, sidesRCB, edgesRCB, conRCB, false, false);

			bool eraseSides[4] = { true, true, true, true };

			p1.set(-l / 2.0 + f + h / 2, 0, -x / 2 + b + r - fo / 2);
			addEraseRect(p1, vz, vy, a, h, eraseSides);
		}

		// front flange box
		p1.set(-l / 2.0 + f + h / 2.0, 0, (x - fo) / 2.0 + fo);
		p2.set(-l / 2.0 + f + h / 2.0, 0, (x - fo) / 2.0);
		cp[0] = p1;  cp[1] = p2;
		v[0] = vz;  v[1] = vz;
		upv[0] = vx;  upv[1] = vx;
		double tabWidthFFB[2] = { a, a };  // remember how perpVector works!!!
		double tabHeightFFB[2] = { h, h };
		bool sidesFFB[4] = { true, true, true, true };
		makeBox(1, cp, v, upv, tabWidthFFB, tabHeightFFB, sidesFFB, false, false, (size > flange_3) ? 0 : 5, 5, flange_3 - size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  h = copyh;  e = copye;  f = copyf;  r = copyr;  m = copym;  l = copyl;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		b -= 2 * size;  d -= 2 * size;  h -= 2 * size;  a -= 2 * size;
		f += size;  e += size;  m += size;  r += size;

		double x = e + d + m;

		FdPoint3d p1, p2;
		// left offside ISC
		p1.set(-l / 2.0 - fo, 0, (b - x - fo) / 2.0 + size);
		p2.set(-l / 2.0,      0, (b - x - fo) / 2.0 + size);
		FdPoint3d cp[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabWidthLOB[2] = { b, b };
		double tabHeightLOB[2] = { a, a };
		bool sides[4] = { true, true, true, true };
		makeBox(1, cp, v, upv, tabWidthLOB, tabHeightLOB, sides, false, false, 0, 5, size);

		// right offside ISC
		p1.set( l / 2.0 + fo, 0, (d - x - fo) / 2.0 + m);
		p2.set( l / 2.0,      0, (d - x - fo) / 2.0 + m);
		cp[0] = p1;  cp[1] = p2;
		double tabWidthROB[2] = { d, d };
		double tabHeightROB[2] = { a, a };
		makeBox(1, cp, v, upv, tabWidthROB, tabHeightROB, sides, false, false, 0, 5, size);

		// far box
		p1.set(-l / 2.0, 0, (m - x - fo) / 2.0 + d / 4.0 + size / 2);
		p2.set( l / 2.0, 0, -(x + fo) / 2.0 + m + d / 4.0);
		cp[0] = p1;  cp[1] = p2;
		double tabWidth[2] = { (m + d / 2.0) - size, d / 2.0 };
		double tabHeight[2] = { a, a };
		sides[1] = false;
		bool con[2] = { false, false };
		bool edges[3][4] = { true, true,  true,  true,
		                     true, false, false, true,
		                     true, true,  true,  true };
		makeBox(1, cp, v, tabWidth, tabHeight, sides, edges, con, false, false);

		// left bend
		p1.set(-l / 2.0 + f - r, 0, -(x + fo) / 2.0 + b - d / 4.0 + size);
		bool sidesL[4] = { true, false, true, false };
		makeRectBend(p1, vx, vy, sidesL,  true, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);
		bool sidesL2[4] = { false, true, false, false };
		makeRectBend(p1, vx, vy, sidesL2, true, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);

		// right bend
		p1.set(-l / 2.0 + f + h + r, 0, -(x + fo) / 2.0 + m + 3.0 / 4.0 * d);
		makeRectBend(p1, vx, vy, sidesL,  false, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);
		makeRectBend(p1, vx, vy, sidesL2, false, d / 2.0, a, h / 2.0, HOW_COMPLEX, r, false);

		// left box
		if( (f - r) > 0 )
		{
			p1.set(-l / 2.0,         0, -x / 2.0 + (b + m + d - fo) / 2.0 - d / 4.0 + size / 2);
			p2.set(-l / 2.0 + f - r, 0, -x / 2.0 + (b + m + d - fo) / 2.0 - d / 4.0 + size / 2);
			cp[0] = p1;  cp[1] = p2;

			v[0] = vx;  v[1] = vx;
			double tabWidthLB[2] = { b - m - d / 2.0 + size, b - m - d / 2.0 + size };
			double tabHeightLB[2] = { a, a };
			bool sidesLB[4] = { true, true, true, false };
			bool conLB[2] = { false, false };
			bool edgesLB[3][4] = { false, false, false, false,
			                       false, true,  true,  false,
			                       false, false, false, false };
			makeBox(1, cp, v, tabWidthLB, tabHeightLB, sidesLB, edgesLB, conLB, false, false);

			bool eraseSides[4] = { false, true, false, true };
			p1.set(-l / 2.0 + (f - r), 0, -x / 2.0 + (b - (m + d / 2.0)) / 2.0 + m + d / 2.0 - fo / 2);
			addEraseRect(p1, vx, -vz, b - m - d / 2.0, a, eraseSides);

			eraseSides[0] = true;  eraseSides[1] = false;  eraseSides[2] = true;  eraseSides[3] = false;
			p1.set(-l / 2.0 + (f - r), 0, -x / 2.0 + (b - (m + d / 2.0)) / 2.0 + m + d / 2.0 - fo / 2);
			addEraseRect(p1, vx, -vz, b - m - d / 2.0, a, -vz, eraseSides);
		}

		// right box
		if( (f + h + r) < l )
		{
			p1.set(-l / 2.0 + f + h + r, 0, -(x + fo) / 2.0 + m + 3.0 / 4.0 * d);
			p2.set( l / 2.0,             0, -(x + fo) / 2.0 + m + 3.0 / 4.0 * d);
			cp[0] = p1;  cp[1] = p2;

			v[0] = vx;  v[1] = vx;
			double tabWidthRB[2] = { d / 2.0, d / 2.0 };
			double tabHeightRB[2] = { a, a };
			bool sidesRB[4] = { true, true, true, false };
			bool conRB[2] = { false, false };
			bool edgesRB[3][4] = { false, false, false, false,
			                       false, true,  true,  false,
			                       false, false, false, false };
			makeBox(1, cp, v, tabWidthRB, tabHeightRB, sidesRB, edgesRB, conRB, false, false);

			bool eraseSides[4] = { false, true, false, true };
			p1.set(-l / 2.0 + f + h + r, 0, -x / 2.0 + m + 3.0 / 4.0 * d - fo / 2);
			addEraseRect(p1, vx, -vz, d / 2, a, eraseSides);

			eraseSides[0] = true;  eraseSides[1] = false;  eraseSides[2] = true;  eraseSides[3] = false;
			p1.set(-l / 2.0 + f + h + r, 0, -x / 2.0 + m + 3.0 / 4.0 * d - fo / 2);
			addEraseRect(p1, vx, -vz, d / 2, a, -vz, eraseSides);
		}

		if( (b - m - d + size) > 0 )
		{
			// inside box
			p1.set(-l / 2.0 + f - r,       0, -x / 2.0 + m + (b - m - fo) / 2.0 + size / 2);
			p2.set(-l / 2.0 + f + h / 2.0, 0, -x / 2.0 + m + (b - m - fo) / 2.0 + size / 2);
			cp[0] = p1;  cp[1] = p2;

			v[0] = vx;  v[1] = vx;
			double tabWidthIB[2] = { b - m - d + size, b - m - d + size };
			double tabHeightIB[2] = { a, a };
			bool sidesIB[4] = { true, false, true, false };
			bool conIB[2] = { false, false };
			bool edgesIB[3][4] = { false, false, false, false,
			                       false, false, false, false,
			                       true,  false, true,  false };
			makeBox(1, cp, v, tabWidthIB, tabHeightIB, sidesIB, edgesIB, conIB, false, false);

			bool eraseSidesIB[4] = { true, true, true, true };
			p1.set(-l / 2.0 + f - r + (h / 2 + r) / 2, 0, -x / 2.0 + m + d / 2.0 + (b - (d / 2.0 + m + d / 2.0)) / 2.0 + (b - m - d) / 2 - fo / 2);
			addEraseRect(p1, vz, vy, a, h / 2 + r, eraseSidesIB);
		}

		// right closer box
		if( (e - r) > 0 )
		{
			p1.set(-l / 2.0 + f + h / 2.0, 0, -x / 2.0 + r + (b + m + d - fo) / 2.0 + size / 2);
			p2.set(-l / 2.0 + f + h,       0, -x / 2.0 + r + (b + m + d - fo) / 2.0 + size / 2);
			cp[0] = p1;  cp[1] = p2;

			double tabWidthRCB[2] = { b - m - d + size, b - m - d + size };
			double tabHeightRCB[2] = { a, a };
			bool sidesRCB[4] = { true, false, true, false };
			bool conRCB[2] = { false, false };
			makeBox(1, cp, tabWidthRCB, tabHeightRCB, sidesRCB, conRCB, false, true);

			bool eraseSides[4] = { true, true, true, true };
			p1.set(-l / 2.0 + f + h / 2 + h / 4, 0, -x / 2 + m + d + r - fo / 2);
			addEraseRect(p1, vz, vy, a, h/2, eraseSides);
		}

		// the closest box - right in front of us - ISC
		if( x > b + r )
		{
			p1.set(-l / 2.0 + f + h / 2.0, 0,  (x - fo) / 2.0);
			p2.set(-l / 2.0 + f + h / 2.0, 0, -(x + fo) / 2.0 + b + r);
			cp[0] = p1;  cp[1] = p2;

			v[0] = vz;  v[1] = vz;
			double tabWidthRCB[2] = { a, a };  // remember how perpVector works!!!
			double tabHeightRCB[2] = { h, h };
			bool sidesRCB[4] = { true, true, true, true };
			bool conRCB[2] = { false, false };
			bool edgesRCB[3][4] = { false, false, false, false,
			                        true,  true,  true,  true,
			                        false, false, false, false };
			makeBox(1, cp, v, tabWidthRCB, tabHeightRCB, sidesRCB, edgesRCB, conRCB, false, false);

			bool eraseSides[4] = { true, true, true, true };

			p1.set(-l / 2.0 + f + h / 2, 0, -x / 2 + b + r - fo / 2);
			addEraseRect(p1, vz, vy, a, h, eraseSides);
		}

		// front flange box
		p1.set(-l / 2.0 + f + h /2.0, 0, (x - fo) / 2.0 + fo);
		p2.set(-l / 2.0 + f + h /2.0, 0, (x - fo) / 2.0);
		cp[0] = p1;  cp[1] = p2;
		v[0] = vz;  v[1] = vz;
		upv[0] = vx;  upv[1] = vx;
		double tabWidthFFB[2] = { a, a };  // remember how perpVector works!!!
		double tabHeightFFB[2] = { h, h };
		bool sidesFFB[4] = { true, true, true, true };
		makeBox(1, cp, v, upv, tabWidthFFB, tabHeightFFB, sidesFFB, false, false, 0, 5, size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  h = copyh;  e = copye;  f = copyf;  r = copyr;  m = copym;  l = copyl;
	setPrimitiveMode(FLM3Geo::pmNormal);

	// SPECIFY LINE TYPES:
	// front flange connector and thin lines...
	p1.set(-l / 2.0 + f + h / 2, 0, x / 2 + fo / 2);
	addRectangularConnector(p1, vz, vy, a + 2 * flange_3, h + 2 * flange_3);
	makeRectangularFlange(p1, vz, vy, a, h, flange_3);

	p1.set(-l / 2.0 + f + h / 2, 0, x / 2 - fo / 2);
	addSymbolicFlangeRect(p1, vz, vy, a, h);
	drawRectAsThinLines(p1, vz, vy, a, h);

	p1.set(-l / 2.0 + f + h / 2, 0, x / 2 + fo / 2);
	p2.set(-l / 2.0 + f + h / 2, 0, x / 2 - fo / 2);
	addCenterLine(p1, p2);

	// left flange connector, thin lines, and center lines...
	p1.set(-l / 2.0 - fo, 0, -x / 2.0 + b / 2.0 - fo / 2);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);

	p1.set(-l / 2.0, 0, -x / 2.0 + b / 2.0 - fo / 2);
	addSymbolicFlangeRect(p1, vx, vy, a, b);
	drawRectAsThinLines(p1, vx, vy, a, b);

	p1.set(-l / 2.0 - fo, 0, -x / 2.0 + b / 2.0 - fo / 2);
	p2.set(-l / 2.0, 0, -x / 2.0 + b / 2.0 - fo / 2);
	addCenterLine(p1, p2);

	// right flange connector, thin lines, and center lines...
	p1.set( l / 2.0 + fo, 0, -x / 2.0 + m + d / 2 - fo / 2);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_2, d + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, d, flange_2);

	p1.set( l / 2.0, 0, -x / 2.0 + m + d / 2 - fo / 2);
	addSymbolicFlangeRect(p1, vx, vy, a, d);
	drawRectAsThinLines(p1, vx, vy, a, d);

	p1.set( l / 2.0 + fo, 0, -x / 2.0 + m + d / 2 - fo / 2);
	p2.set( l / 2.0, 0, -x / 2.0 + m + d / 2 - fo / 2);
	addCenterLine(p1, p2);

#ifndef __TODO__
	//--- Add the center lines that create a 'T'.
	FdPoint3d leftCenterStart(   l / 2,             0, -x / 2.0 + m + d / 2 - fo / 2  ),
	          rightCenterStart( -l / 2,             0, -x / 2.0 + b / 2 - fo / 2      ),
	          frontCenterStart( -l / 2 + f + h / 2, 0,  x / 2 - fo / 2                );
	addCenterLine(leftCenterStart, rightCenterStart);
	FdPoint3d intPoint;
	lineSegToLineSegInt(leftCenterStart, rightCenterStart, frontCenterStart, frontCenterStart + -zVec * (d + e) * 2, intPoint);
	addCenterLine(frontCenterStart, intPoint);
#else
	// center line connecting the left and right flange
	p1.set( l / 2.0, 0, -x / 2.0 + m + d / 2 - fo / 2);
	p2.set(-l / 2.0, 0, -x / 2.0 + b / 2.0 - fo / 2);
	addCenterLine(p1, p2);

	// center line connecting the front flange with the main center line to create the "T"
	double centerNormal[3] = { l / 2, 0, ((-x / 2.0 + m + d / 2 - fo / 2) - (-x / 2.0 + b / 2.0 - fo / 2)) / 2 };
	p1.set(-l / 2.0 + centerNormal[0], 0, -x / 2.0 + b / 2.0 - fo / 2 + centerNormal[2]);
	p2.set(-l / 2.0 + f + h / 2, 0, x / 2 - fo / 2);
	addCenterLine(p1, p2);
#endif

	//--- Add erase lines.
	p1.set(-l / 2.0, a / 2, -x / 2.0 + m + d / 2.0 - fo / 2);
	p2.set( l / 2.0, a / 2, -x / 2.0 + m + d / 2.0 - fo / 2);
	addEraseLine(p1, p2);

	p1.set(-l / 2.0, -a / 2, -x / 2.0 + m + d / 2.0 - fo / 2);
	p2.set( l / 2.0, -a / 2, -x / 2.0 + m + d / 2.0 - fo / 2);
	addEraseLine(p1, p2);

	p1.set(-l / 2.0 + f + h / 2,  a / 2, x / 2 - fo / 2);
	p2.set(-l / 2.0 + f + h / 2,  a / 2, x / 2 - b * d * e - fo / 2);
	addEraseLine(p1, p2);

	p1.set(-l / 2.0 + f + h / 2, -a / 2, x / 2 - fo / 2);
	p2.set(-l / 2.0 + f + h / 2, -a / 2, x / 2 - b * d * e - fo / 2);
	addEraseLine(p1, p2);
}

void GLERectangular :: makeTG(double a, double b, double d, double h, double e, double f, double r, double l, double n, double flange_1, double flange_2, double flange_3)
{
	makeTA(a, b, d, h, e, f, r, 0, l, n, flange_1, flange_2, flange_3);
}

void GLERectangular :: makeTR1(double a, double b, double g, double h, double l, double e, double f, double l3, double flange_1, double flange_2, double flange_3)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);
	l = l - 2 * fo;  e -= fo;

	/**********************************GEOMETRY*************************************/
	// inside box
	FdPoint3d p1(-l / 2.0 - fo, 0, 0),
	          p2(-l / 2.0,      0, 0),
	          p3( l / 2.0,      0, 0),
	          p4( l / 2.0 + fo, 0, 0);
	FdPoint3d cp[4] = { p1, p2, p3, p4 };
	FdVector3d vec1[4] = { vx, vx, vx, vx };
	double tabWidth[4] = { b, b, b, b };
	double tabHeight[4] = { a, a, a, a };
	bool sides[12] = { true, true,  true, true,
	                   true, false, true, true,
	                   true, true,  true, true };
	bool edges1[7][4] = { true,  true,  true,  true,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      true,  true,  true,  true };
	bool con[2] = { false, false };
	makeBox(3, cp, vec1, tabWidth, tabHeight, sides, edges1, con, false, false);

	// close plane
	p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
	p2.set(0, 0, b / 2.0);
	cp[0] = p1;  cp[1] = p2;
	FdVector3d v[3] = { vz, vz, vz };
	FdVector3d upv[3] = { vy, vy, vy };
	tabHeight[0] = g;  tabHeight[1] = a;
	tabWidth[0] = h;  tabWidth[1] = l;
	bool edges[3][4] = { false, false, false, false,
	                     false, false, false, false,
	                     false, false, false, false };
	makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, edges, false, false, 5, 5, CONNECTOR_SIZE);

	// close branch
	p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
	p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
	p3.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
	cp[0] = p1;  cp[1] = p2;  cp[2] = p3;

	tabHeight[0] = tabHeight[1] = tabHeight[2] = g;
	tabWidth[0] = tabWidth[1] = tabWidth[2] = h;
	bool edgesb[5][4] = { true,  true,  true,  true,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      true,  true,  true,  true };

	sides[5] = true;
	makeBox(2, cp, v, upv, tabWidth, tabHeight, sides, edgesb, false, false, 5, 5, CONNECTOR_SIZE);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyg = g, copyh = h, copyl = l, copye = e, copyf = f, copyl3 = l3;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		a += 2 * size;  b += 2 * size;  g += 2 * size;  h += 2 * size;
		l3 -= size;  f += size;

		// inside box
		FdPoint3d p1(-l / 2.0 - fo, 0, 0),
		          p2(-l / 2.0,      0, 0),
		          p3( l / 2.0,      0, 0),
		          p4( l / 2.0 + fo, 0, 0);
		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { b, b, b, b };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true, true,  true, true,
		                   true, false, true, true,
		                   true, true,  true, true };
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, (size > flange_1) ? 0 : 5, (size > flange_2) ? 0 : 5, (flange_1 > flange_2) ? (flange_2 - size) : (flange_1 - size));

		// close plane
		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(0, 0, b / 2.0);
		cp[0] = p1;  cp[1] = p2;
		v[0] = v[1] = v[2] = vz;
		upv[0] = upv[1] = upv[2] = vy;
		tabHeight[0] = g;  tabHeight[1] = a;
		tabWidth[0] = h;  tabWidth[1] = l;
		sides[5] = true;
		bool edges[3][4] = { false, false, false, false,
		                     false, false, false, false,
		                     false, false, false, false };
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, edges, false, false, 5, 5, flange_3 - size);

		// close branch
		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
		p3.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
		cp[0] = p1;  cp[1] = p2;  cp[2] = p3;

		tabHeight[0] = tabHeight[1] = tabHeight[2] = g;
		tabWidth[0] = tabWidth[1] = tabWidth[2] = h;
		makeBox(2, cp, v, upv, tabWidth, tabHeight, sides, edgesb, false, false, 5, (size > flange_3) ? 0 : 5, flange_3 - size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  g = copyg;  h = copyh;  l = copyl;  e = copye;  f = copyf;  l3 = copyl3;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		a -= 2 * size;  b -= 2 * size;  g -= 2 * size;  h -= 2 * size;
		l3 += size;  f -= size;

		// inside box
		FdPoint3d p1(-l / 2.0 - fo, 0, 0),
		          p2(-l / 2.0,      0, 0),
		          p3( l / 2.0,      0, 0),
		          p4( l / 2.0 + fo, 0, 0);
		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { b, b, b, b };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true, true,  true, true,
		                   true, false, true, true,
		                   true, true,  true, true };
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, 0, 0, size);

		// close plane
		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(0, 0, b / 2.0);
		cp[0] = p1;  cp[1] = p2;
		v[0] = v[1] = v[2] = vz;
		upv[0] = upv[1] = upv[2] = vy;
		tabHeight[0] = g;  tabHeight[1] = a;
		tabWidth[0] = h;  tabWidth[1] = l;
		sides[5] = true;
		bool edges[3][4] = { false, false, false, false,
		                     false, false, false, false,
		                     false, false, false, false };
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, edges, false, false, 5, 5, size);

		// close branch
		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
		p3.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
		cp[0] = p1;  cp[1] = p2;  cp[2] = p3;

		tabHeight[0] = tabHeight[1] = tabHeight[2] = g;
		tabWidth[0] = tabWidth[1] = tabWidth[2] = h;
		makeBox(2, cp, v, upv, tabWidth, tabHeight, sides, edgesb, false, false, 5, 0, size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  g = copyg;  h = copyh;  l = copyl;  e = copye;  f = copyf;  l3 = copyl3;
	setPrimitiveMode(FLM3Geo::pmNormal);

	//--- Specify connector, center, and thin lines for the close branch.
	p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
	p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
	addRectangularConnector(p1, vz, vy, g + 2 * flange_3, h + 2 * flange_3);
	makeRectangularFlange(p1, vz, vy, g, h, flange_3);
	addSymbolicFlangeRect(p2, vz, vy, g, h);
	drawRectAsThinLines(p2, vz, vy, g, h);

	//--- specify a center line for the branch duct
	p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2);
	p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2 + l3);
	addCenterLine(p1, p2);

	//------- SPECIFY LINES FOR THE MAIN DUCT
	l += fo * 2;

	//--- specify lines that should be drawn as thin
	p1.set(-l / 2 + fo, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, a, b);
	drawRectAsThinLines(p1, vx, vy, a, b);

	p1.set( l / 2 - fo, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, a, b);
	drawRectAsThinLines(p1, vx, vy, a, b);

	//--- specify two rectangular connectors
	p1.set(-l / 2, 0, 0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);

	p2.set( l / 2, 0, 0);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	//--- add the center lines for...
	//- for the duct axis
	addCenterLine(p1, p2);
}

void GLERectangular :: makeTR1a(double a, double b, double d, double g, double h, double l, double e, double f, double l3, double flange_1, double flange_2, double flange_3)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	l = l - 2 * fo;
	e -= fo;

	/**********************************GEOMETRY*************************************/
	// inside box
	FdPoint3d p1, p2, p3, p4;
	p1.set(-l / 2.0 - fo, 0, 0);
	p2.set(-l / 2.0,      0, 0);
	p3.set( l / 2.0,      0, b / 2 - d / 2);
	p4.set( l / 2.0 + fo, 0, b / 2 - d / 2);
	FdPoint3d cp[4] = { p1, p2, p3, p4 };
	FdVector3d v[4] = { vx, vx, vx, vx };
	double tabWidth[4] = { b, b, d, d };
	double tabHeight[4] = { a, a, a, a };
	bool sides[12] = { true, true,  true, true,
	                   true, false, true, true,
	                   true, true,  true, true };
	bool edges1[7][4] = { true,  true,  true,  true,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      true,  true,  true,  true };
	bool con[2] = { false, false };
	makeBox(3, cp, v, tabWidth, tabHeight, sides, edges1, con, false, false);

	//--- add the center line for the duct axis
	addCenterPolyLine(cp, 3);

	//------- SPECIFY LINES FOR THE MAIN DUCT
	l += fo * 2;

	//--- specify lines that should be drawn as thin
	p1.set(-l / 2 + fo, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, a, b);
	drawRectAsThinLines(p1, vx, vy, a, b);

	p1.set( l / 2 - fo, 0, cp[2].z);
	addSymbolicFlangeRect(p1, vx, vy, a, d);
	drawRectAsThinLines(p1, vx, vy, a, d);

	//--- specify two rectangular connectors
	p1.set(-l / 2, 0, 0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);

	p1.set( l / 2, 0, cp[2].z);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_2, d + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, d, flange_2);

	l = l - 2 * fo;
	// close plane
	p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
	p2.set(0, 0, b / 2.0);
	cp[0] = p1;  cp[1] = p2;

	v[0] = v[1] = v[2] = vz;
	FdVector3d upv[3] = { vy, vy, vy };
	tabHeight[0] = g;  tabHeight[1] = a;
	tabWidth[0] = h;  tabWidth[1] = l;
	bool edges[3][4] = { false, false, false, false,
	                     false, false, false, false,
	                     false, false, false, false };
	makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, edges, false, false, 5, 5, CONNECTOR_SIZE);

	// close branch
	sides[5] = true;
	p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
	p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
	p3.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
	cp[0] = p1;  cp[1] = p2;  cp[2] = p3;

	tabHeight[0] = tabHeight[1] = tabHeight[2] = g;
	tabWidth[0] = tabWidth[1] = tabWidth[2] = h;
	bool edgesb[5][4] = { true,  true,  true,  true,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      true,  true,  true,  true };
	makeBox(2, cp, v, upv, tabWidth, tabHeight, sides, edgesb, false, false, 5, 5, CONNECTOR_SIZE);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyd = d, copyg = g, copyh = h, copyl = l, copye = e, copyf = f, copyl3 = l3;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		a += 2 * size;  b += 2 * size;  d += 2 * size;  g += 2 * size;  h += 2 * size;
		l3 -= size;  f += size;

		// inside box
		FdPoint3d p1, p2,p3,p4;
		p1.set(-l / 2.0 - fo, 0, 0);
		p2.set(-l / 2.0,      0, 0);
		p3.set( l / 2.0,      0, b / 2 - d / 2);
		p4.set( l / 2.0 + fo, 0, b / 2 - d / 2);
		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { b, b, d, d };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true, true,  true, true,
		                   true, false, true, true,
		                   true, true,  true, true };
		bool edges1[7][4] = { true,  true,  true,  true,
		                      true,  true,  true,  true,
		                      false, false, false, false,
		                      true,  true,  true,  true,
		                      false, false, false, false,
		                      true,  true,  true,  true,
		                      true,  true,  true,  true };
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, (size > flange_1) ? 0 : 5, (size > flange_2) ? 0 : 5, (flange_1 > flange_2) ? (flange_2 - size) : (flange_1 - size));

		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(0, 0, b / 2.0);
		cp[0] = p1;  cp[1] = p2;
		v[0] = v[1] = v[2] = vz;
		tabHeight[0] = g;  tabHeight[1] = a;
		tabWidth[0] = h;  tabWidth[1] = l;
		bool edges[3][4] = { false, false, false, false,
		                     false, false, false, false,
		                     false, false, false, false };
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, edges, false, false, 5, 5, CONNECTOR_SIZE);

		// close branch
		sides[5] = true;
		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
		p3.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
		cp[0] = p1;  cp[1] = p2;  cp[2] = p3;
		tabHeight[0] = tabHeight[1] = tabHeight[2] = g;
		tabWidth[0] = tabWidth[1] = tabWidth[2] = h;
		makeBox(2, cp, v, upv, tabWidth, tabHeight, sides, edgesb, false, false, 5, (size > flange_3) ? 0 : 5, flange_3 - size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  g = copyg;  h = copyh;  l = copyl;  e = copye;  f = copyf;  l3 = copyl3;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		a -= 2 * size;  b -= 2 * size;  d -= 2 * size;  g -= 2 * size;  h -= 2 * size;
		l3 += size;  f -= size;

		// inside box
		FdPoint3d p1, p2, p3, p4;
		p1.set(-l / 2.0 - fo, 0, 0);
		p2.set(-l / 2.0,      0, 0);
		p3.set( l / 2.0,      0, b / 2 - d / 2);
		p4.set( l / 2.0 + fo, 0, b / 2 - d / 2);
		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { b, b, d, d };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true, true,  true, true,
		                   true, false, true, true,
		                   true, true,  true, true };
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, 0, 0, size);

		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(0, 0, b / 2.0);
		cp[0] = p1;  cp[1] = p2;
		v[0] = v[1] = v[2] = vz;
		tabHeight[0] = g;  tabHeight[1] = a;
		tabWidth[0] = h;  tabWidth[1] = l;
		bool edges[3][4] = { false, false, false, false,
		                     false, false, false, false,
		                     false, false, false, false };
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, edges, false, false, 5, 5, size);

		// close branch
		sides[5] = true;
		p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0);
		p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
		p3.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
		cp[0] = p1;  cp[1] = p2;  cp[2] = p3;
		tabHeight[0] = tabHeight[1] = tabHeight[2] = g;
		tabWidth[0] = tabWidth[1] = tabWidth[2] = h;
		makeBox(2, cp, v, upv, tabWidth, tabHeight, sides, edgesb, false, false, 5, 0, size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  g = copyg;  h = copyh;  l = copyl;  e = copye;  f = copyf;  l3 = copyl3;
	setPrimitiveMode(FLM3Geo::pmNormal);

	//--- specify connector, center, and thin lines for the close branch
	p1.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3);
	p2.set(-l / 2.0 + e, a / 2.0 - f, b / 2.0 + l3 - fo);
	addRectangularConnector(p1, vz, vy, g + 2 * flange_3, h + 2 * flange_3);
	makeRectangularFlange(p1, vz, vy, g, h, flange_3);
	addSymbolicFlangeRect(p2, vz, vy, g, h);
	drawRectAsThinLines(p2, vz, vy, g, h);

	//--- specify a center line for the branch duct
	p1.set(cp[2].x, cp[2].y, b / 2);
	p2.set(cp[2].x, cp[2].y, b / 2 + l3);
	addCenterLine(p1, p2);
}

void GLERectangular :: makeTR2a(double height, double width1, double width2, double diam1, double length1, double length2, double e, double f, int n, double flange_1, double flange_2)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	/****************************Copy/create Insulation vairables*******************/
	double copyheight = height, copywidth1 = width1, copywidth2 = width2, copydiam1 = diam1,
	       copylength1 = length1, copylength2 = length2, copye = e, copyf = f;

	/**********************************GEOMETRY*************************************/
	// inside box
	FdPoint3d p1, p2, p3, p4;
	p1.set(-length1 / 2.0,      0, 0);
	p2.set(-length1 / 2.0 + fo, 0, 0);
	p3.set( length1 / 2.0 - fo, 0, width1 / 2 - width2 / 2);
	p4.set( length1 / 2.0,      0, width1 / 2 - width2 / 2);
	FdPoint3d cp[4] = { p1, p2, p3, p4 };
	FdVector3d v[4] = { vx, vx, vx, vx };
	double tabWidth[4] = { width1, width1, width2, width2 };
	double tabHeight[4] = { height, height, height, height };
	bool sides[12] = { true, true,  true, true,
	                   true, false, true, true,
	                   true, true,  true, true };
	bool edges1[7][4] = { true,  true,  true,  true,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      true,  true,  true,  true };
	bool con[2] = { false, false };
	makeBox(3, cp, v, tabWidth, tabHeight, sides, edges1, con, false, false);

	//--- add the center line for the duct axis
	addCenterPolyLine(cp, 3);

	//--- specify lines that should be drawn as thin
	p1.set(-length1 / 2 + fo, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, height, width1);
	drawRectAsThinLines(p1, vx, vy, height, width1);

	p1.set( length1 / 2 - fo, 0, cp[2].z);
	addSymbolicFlangeRect(p1, vx, vy, height, width2);
	drawRectAsThinLines(p1, vx, vy, height, width2);

	//--- specify two rectangular connectors
	p1.set(-length1 / 2, 0, 0);
	addRectangularConnector(p1, vx, vy, height + 2 * flange_1, width1 + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, height, width1, flange_1);

	p1.set( length1 / 2, 0, cp[2].z);
	addRectangularConnector(p1, vx, vy, height + 2 * flange_2, width2 + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, height, width2, flange_2);

	// make the plane with circular hole
	p1.set(0, 0, width1 / 2);
	double heightWidth[2] = { length1 - 2 * fo, height };
	FdPoint3d ts(-length1 / 2 + e, height / 2 - f, width1 / 2);
	double tubeParams[3] = { diam1, diam1, 0 };
	makeRectToTubeTransition(p1, vz, vx, heightWidth, ts, tubeParams, n);

	// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
	p1.set(-length1 / 2 + e, height / 2 - f, width1 / 2);
	p2.set(-length1 / 2 + e, height / 2 - f, width1 / 2 + length2);
	cp[0] = p1;  cp[1] = p2;
	makeVerySimpleTube(cp, diam1, n);

	//--- specify connector, center, and thin lines for the close branch
    addCircularConnector(cp[1]);
	drawAsThinArc(cp[0]);

	//--- specify a center line for the branch duct
	addCenterLine(cp[0], cp[1]);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		height += 2 * size;  width1 += 2 * size;  width2 += 2 * size;
		diam1 += size;  f += size;  length2 -= size;

		// inside box
		FdPoint3d p1, p2, p3, p4;
		p1.set(-length1 / 2.0,      0, 0);
		p2.set(-length1 / 2.0 + fo, 0, 0);
		p3.set( length1 / 2.0 - fo, 0, width1 / 2 - width2 / 2);
		p4.set( length1 / 2.0,      0, width1 / 2 - width2 / 2);
		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { width1, width1, width2, width2 };
		double tabHeight[4] = { height, height, height, height };
		bool sides[12] = { true, true,  true, true,
		                   true, false, true, true,
		                   true, true,  true, true };
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, (size > flange_1) ? 0 : 5, (size > flange_2) ? 0 : 5, (flange_1 > flange_2) ? (flange_2 - size) : (flange_1 - size));

		// make the plane with circular hole
		p1.set(0, 0, width1 / 2);
		double heightWidth[2] = { length1 - 2 * fo, height };
		FdPoint3d ts(-length1 / 2 + e, height / 2 - f, width1 / 2);
		double tubeParams[3] = { diam1, diam1, 0 };
		makeRectToTubeTransition(p1, vz, vx, heightWidth, ts, tubeParams, n);

		// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
		p1.set(-length1 / 2 + e, height / 2 - f, width1 / 2);
		p2.set(-length1 / 2 + e, height / 2 - f, width1 / 2 + length2);
		cp[0] = p1;  cp[1] = p2;
		makeVerySimpleTube(cp, diam1, n);

		makeFlatRing(p2, vz, diam1, diam1 - size, n);
	}

	/**********************************Recover variables*******************************/
	height = copyheight;  width1 = copywidth1;  width2 = copywidth2;  diam1 = copydiam1;
	length1 = copylength1;  length2 = copylength2;  e = copye;  f = copyf;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		height -= 2 * size;  width1 -= 2 * size;  width2 -= 2 * size;
		diam1 -= size;  f -= size;  length2 += size;

		// inside box
		FdPoint3d p1, p2, p3, p4;
		p1.set(-length1 / 2.0,      0, 0);
		p2.set(-length1 / 2.0 + fo, 0, 0);
		p3.set( length1 / 2.0 - fo, 0, width1 / 2 - width2 / 2);
		p4.set( length1 / 2.0,      0, width1 / 2 - width2 / 2);
		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { width1, width1, width2, width2 };
		double tabHeight[4] = { height, height, height, height };
		bool sides[12] = { true, true,  true, true,
		                   true, false, true, true,
		                   true, true,  true, true };
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, 0, 0, size);

		// make the plane with circular hole
		p1.set(0, 0, width1 / 2);
		double heightWidth[2] = { length1 - 2 * fo, height };
		FdPoint3d ts(-length1 / 2 + e, height / 2 - f, width1 / 2);
		double tubeParams[3] = { diam1, diam1, 0 };
		makeRectToTubeTransition(p1, vz, vx, heightWidth, ts, tubeParams, n);

		// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
		p1.set(-length1 / 2 + e, height / 2 - f, width1 / 2);
		p2.set(-length1 / 2 + e, height / 2 - f, width1 / 2 + length2);
		cp[0] = p1;  cp[1] = p2;
		makeVerySimpleTube(cp, diam1, n);

		makeFlatRing(p2, vz, diam1 + size, diam1, n);
	}
}

void GLERectangular :: makeTR3(double a, double b, double h, double d, double r, double n, double flange_1, double flange_2, double flange_3)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	/**********************************GEOMETRY*************************************/
    // 4 times bend piece + looking for intersection :) - everything encapsulated in one procedure
	calcTR3(a, b, d, h, r, n, 0);

	double 
		frontFlangeZ = (d > h) ? ((d + r + fo) / 2.0) : ((h + r + fo) / 2.0),
		leftFlangeX  = -b / 2.0 - r - fo,
		leftFlangeZ  = ((d > h) ? ((d + r + fo) / 2.0) : ((h + r + fo) / 2.0)) - (r + d / 2 + fo)  ,
		rightFlangeX = b / 2.0 + r + fo,
		rightFlangeZ = ((d > h) ? ((d + r + fo) / 2.0) : ((h + r + fo) / 2.0)) - (r + h / 2 + fo) ;  

	FdPoint3d
		front      ( 0,                 0, frontFlangeZ - fo ),
		left       ( leftFlangeX  + fo, 0, leftFlangeZ       ),
		right      ( rightFlangeX - fo, 0, rightFlangeZ      ),
		leftCenter ( leftFlangeX  + fo, 0, frontFlangeZ - fo ),
		rightCenter( rightFlangeX - fo, 0, frontFlangeZ - fo );

	// front flange
	FdPoint3d p1(0, 0, frontFlangeZ), p2(0, 0, frontFlangeZ - fo);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { a, a };  // remember how perpVector works
	double tabHeight[2] = { b, b };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };
	makeBox(1, centralPoints, tabWidth, tabHeight, sides, con, false, false);

	// left flange
	p1.set(leftFlangeX,      0, leftFlangeZ);
	p2.set(leftFlangeX + fo, 0, leftFlangeZ);
	FdPoint3d centralPointsL[2] = { p1, p2 };
	tabWidth[0] = tabWidth[1] = d;
	tabHeight[0] = tabHeight[1] = a;
	makeBox(1, centralPointsL, tabWidth, tabHeight, sides, con, false, false);

	// right flange
	p1.set(rightFlangeX,      0, rightFlangeZ);
	p2.set(rightFlangeX - fo, 0, rightFlangeZ);
	FdPoint3d centralPointsR[2] = { p1, p2 };
	tabWidth[0] = tabWidth[1] = h;
	makeBox(1, centralPointsR, tabWidth, tabHeight, sides, con, false, false);

	//---ADD HLR LINE TYPE INFO

	// CENTER LINES:
	addCenterLine(left,  left  - vx * fo);  // Left flange center line.
	addCenterLine(right, right + vx * fo);  // Right flange center line.

	FdPoint3d leftCopy  = left;   leftCopy.rotateBy (M_PI / 2, -vy, leftCenter);
	FdPoint3d rightCopy = right;  rightCopy.rotateBy(M_PI / 2,  vy, rightCenter);
	addCenterLine(leftCopy,  leftCopy  + vz * fo);  // Left bend center line for front flange.
	addCenterLine(rightCopy, rightCopy + vz * fo);  // Right bend center line for front flange.

	// CENTER ARCS:
	addCenterArc(leftCenter, -vy, -vz, r + d / 2, 0, M_PI / 2);
	addCenterArc(rightCenter, vy, -vz, r + h / 2, 0, M_PI / 2);

	// THIN LINES:
	addSymbolicFlangeRect(front, vz, vy, a, b);
	drawRectAsThinLines(front, vz, vy, a, b);
	addSymbolicFlangeRect(left,  vx, vy, a, d);
	drawRectAsThinLines(left,  vx, vy, a, d);
	addSymbolicFlangeRect(right, vx, vy, a, h);
	drawRectAsThinLines(right, vx, vy, a, h);

	// CONNECTORS:
	addRectangularConnector(front + vz * fo, vz, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(front + vz * fo, vz, vy, a, b, flange_1);

	addRectangularConnector(left - vx * fo, vx, vy, a + 2 * flange_2, d + 2 * flange_2);
	makeRectangularFlange(left - vx * fo, vx, vy, a, d, flange_2);

	addRectangularConnector(right + vx * fo, vx, vy, a + 2 * flange_3, h + 2 * flange_3);
	makeRectangularFlange(right + vx * fo, vx, vy, a, h, flange_3);

	//--- Add an erase region which erases both lines that form from the intersection
	//--- where the two bend pieces meet. This region is parallel to the front "b"
	//--- connector. Erase regions must be perpendicular to the lines they intend to erase.
	front += vy * (a / 2);
	addEraseRegion(front - vz - vx * (b / 2 - 1), front - vz + vx * (b / 2 - 1), front - vz + vx * (b / 2 - 1) - vy * (a));

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyd = d, copyh = h, copyr = r;

	/**********************************Ext Insulation*******************************/
	double size = 20;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		if( size >= r )
			{  size = r - 0.1;  };

		b += 2 * size;  d += 2 * size;  h += 2 * size;  a += 2 * size;
		r -= size;

		calcTR3(a, b, d, h, r, n, -size);

		// front flange
		FdPoint3d p1(0, 0, frontFlangeZ), p2(0, 0, frontFlangeZ - fo);
		FdPoint3d centralPoints[2] = { p1, p2 };
		double tabWidth[2] = { a, a };  // remember how perpVector works
		double tabHeight[2] = { b, b };
		bool sides[4] = { true, true, true, true };
		FdVector3d v[2] = { vz, vz };
		FdVector3d upv[2] = { vx, vx };
		makeBox(1, centralPoints, v, upv, tabWidth, tabHeight, sides, false, false, (size > flange_1) ? 0 : 5, 5, flange_1 - size);

		// left flange
		p1.set(leftFlangeX,      0, leftFlangeZ);
		p2.set(leftFlangeX + fo, 0, leftFlangeZ);
		FdPoint3d centralPointsL[2] = { p1, p2 };
		tabWidth[0] = tabWidth[1] = d;
		tabHeight[0] = tabHeight[1] = a;
		v[0] = v[1] = vx;
		upv[0] = upv[1] = vy;
		makeBox(1, centralPointsL, v, upv, tabWidth, tabHeight, sides, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);

		// right flange
		p1.set(rightFlangeX,      0, rightFlangeZ);
		p2.set(rightFlangeX - fo, 0, rightFlangeZ);
		FdPoint3d centralPointsR[2] = { p1, p2 };
		v[0] = v[1] = -vx;
		tabWidth[0] = tabWidth[1] = h;
		makeBox(1, centralPointsR, v, upv, tabWidth, tabHeight, sides, false, false, (size > flange_3) ? 0 : 5, 5, flange_3 - size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  h = copyh;  r = copyr;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		b -= 2 * size;  d -= 2 * size;  h -= 2 * size;  a -= 2 * size;
		r += size;

		calcTR3(a, b, d, h, r, n, size);

		// front flange
		FdPoint3d p1(0, 0, frontFlangeZ),
		          p2(0, 0, frontFlangeZ - fo);
		FdPoint3d centralPoints[2] = { p1, p2 };
		double tabWidth[2] = { a, a };  // remember how perpVector works
		double tabHeight[2] = { b, b };
		bool sides[4] = { true, true, true, true };
		// bool con[2] = { true, false };
		FdVector3d v[2] = { -vz, -vz };
		FdVector3d upv[2] = { vx, vx };
		makeBox(1, centralPoints, v, upv, tabWidth, tabHeight, sides, false, false, 0, 5, size);

		// left flange
		p1.set(leftFlangeX,      0, leftFlangeZ);
		p2.set(leftFlangeX + fo, 0, leftFlangeZ);
		FdPoint3d centralPointsL[2] = { p1, p2 };
		tabWidth[0] = tabWidth[1] = d;
		tabHeight[0] = tabHeight[1] = a;
		v[0] = v[1] = vx;
		upv[0] = upv[1] = vy;
		makeBox(1, centralPointsL, v, upv, tabWidth, tabHeight, sides, false, false, 0, 5, size);

		// right flange
		p1.set(rightFlangeX,      0, rightFlangeZ);
		p2.set(rightFlangeX - fo, 0, rightFlangeZ);
		FdPoint3d centralPointsR[2] = { p1, p2 };
		tabWidth[0] = tabWidth[1] = h;
		v[0] = v[1] = -vx;
		makeBox(1, centralPointsR, v, upv, tabWidth, tabHeight, sides, false, false, 0, 5, size);
	}
}

void GLERectangular :: makeTR4(double a, double b, double d, double h, double r, double l, double alfa, double n)
{
	double rang = M_PI * alfa / 180.0;
	double offs = r * (1 - cos(rang)) + fo * sin(rang);
	postTransformMesh( M_PI / 2, FdVector3d::kXAxis);
	postTransformMesh(-M_PI / 2, FdVector3d::kZAxis);
	postTransformMesh(FdVector3d(0, offs / 2.0, 0));

	calcTR4(a, b, d, h, r, l, alfa, n);  // inlusation added into this finction... not a wise idea.
}

void GLERectangular :: makeTR6(double a, double b, double d, double g, double h, double e, double flange_1, double flange_2, double flange_3)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	// the main idea is that we have a few boxes here:)
	double x1 = -max(h, b) / 2.0,                y1 = -a / 2.0,                z1 = -max(d, g) / 2.0;
	double x2 =  max(h, b) / 2.0 + e /* + fo */, y2 =  a / 2.0 + e /* + fo */, z2 =  max(d, g) / 2.0 + e /* + fo */;
	// first one is the easiest - the one on the top - it consist of one or two boxes depending on a situation
	// and one of the boxes has 2 segments
	FdPoint3d p1, p2, p3, p4;
	p1.set(x1 + h / 2.0,  y2,            z1 + g / 2.0);
	p2.set(x1 + h / 2.0,  y2 - BSFlange, z1 + g / 2.0);
	p3.set(x1 + h / 2.0,  y2 - e,        z1 + g / 2.0);
	p4.set(x1 + h / 2.0,  y1,            z1 + g / 2.0);
	FdPoint3d cp[4] = { p1, p2, p3, p4 };
	FdVector3d vectors[4] = { -vy, -vy, -vy, -vy };
	double tabWidth[4] = { g, g, g, g };
	double tabHeight[4] = { h, h, h, h };
	bool sides[12] = { true,  true,  true, true,
	                   true,  true,  true, true,
	                   false, false, true, true };
	bool edges[7][4] = { true, true, true,  true,
	                     true, true, true,  true,
	                     true, true, true,  true,
	                     true, true, true,  true,
	                     true, true, false, false,
	                     true, true, true,  true,
	                     true, true, true,  true };
	bool con[2] = { false, false };
	makeBox(3, cp, vectors, tabWidth, tabHeight, sides, edges, con, false, true);

	p1.set(x1 + h / 2.0, y2, z1 + g / 2.0);
	addRectangularConnector(p1, -vy, -vz, g + 2 * flange_1, h + 2 * flange_1);
	makeRectangularFlange(p1, -vy, -vz, g, h, flange_1);

	p1.set(x1 + h / 2.0, y2 - BSFlange, z1 + g / 2.0);
	addSymbolicFlangeRect(p1, -vy, -vz, g, h);
	drawRectAsThinLines(p1, -vy, -vz, g, h);

	p1.set(x1, y2 - e, z1);
	p2.set(x1, y2 - e, z1 + g);
	// makeSymbolicLine(p1, p2);
	addEraseLine(p1, p2);

	p1.set(x1,     y2 - e, z1);
	p2.set(x1 + h, y2 - e, z1);
	// makeSymbolicLine(p1, p2);
	addEraseLine(p1, p2);

	double xOff = max(h, b) / 2 + e, zOff = max(d, g) / 2.0 + e, yOff = a / 2 + e;

	// so first we consider the simplest situation
	if( (b <= h) && (d <= g) )
	{
		// small corner
		p1.set(x1 + b + (h - b) / 2.0,  y2 - e, z1 + d + (g - d) / 2.0);
		p2.set(x1 + b + (h - b) / 2.0,  y1,     z1 + d + (g - d) / 2.0);
		FdPoint3d centralPointsC[2] = { p1, p2 };
		double tabWidthC[2] = { g - d, g - d };
		double tabHeightC[2] = { h - b, h - b };
		bool sidesC[4] = { true, true, false, false };
		bool conC[2] = { false, false };
		makeBox(1, centralPointsC, tabWidthC, tabHeightC, sidesC, conC, false, false);

		p1.set(x1 + b,            y2 - e, z1 + d + (g - d));
		p2.set(x1 + b + (h - b),  y2 - e, z1 + d + (g - d));
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + b + (h - b),  y2 - e, z1 + d);
		p2.set(x1 + b + (h - b),  y2 - e, z1 + d + (g - d));
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		// left box
		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
		p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
		p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + g);
		FdPoint3d centralPointsLB[3] = { p1, p2, p3 };
		double tabWidthLB[3] = { a, a, a };  // remember how perpVector works
		double tabHeightLB[3] = { b, b, b };
		bool sidesLB[8] = { true, true, true, true,
		                    true, true, true, true };
		bool conLB[2] = { false, false };
		makeBox(2, centralPointsLB, tabWidthLB, tabHeightLB, sidesLB, conLB, false, false);

		p1.set(x1, y2 - e,     z1 + g);
		p2.set(x1, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1,     y2 - e - a, z1 + g);
		p2.set(x1 + b, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
		addRectangularConnector(p1, -vz, vy, a + 2 * flange_2, b + 2 * flange_2);
		makeRectangularFlange(p1, -vz, vy, a, b, flange_2);

		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
		addSymbolicFlangeRect(p1, -vz, vy, a, b);
		drawRectAsThinLines(p1, -vz, vy, a, b);

		// right box
		p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
		p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
		p3.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
		FdPoint3d centralPointsRB[3] = { p1, p2, p3 };
		double tabWidthRB[3] = { d, d, d };
		double tabHeightRB[3] = { a, a, a };
		bool sidesRB[8] = { true, true, true, true,
		                    true, true, true, true };
		bool conRB[2] = { false, false };
		makeBox(2, centralPointsRB, tabWidthRB, tabHeightRB, sidesRB, conRB, false, false);

		p1.set(x2, y2 - e - a / 2.0, z1 + d / 2.0);
		addRectangularConnector(p1, vx, vy, a + 2 * flange_3, d + 2 * flange_3);
		makeRectangularFlange(p1, vx, vy, a, d, flange_3);

		p1.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
		addSymbolicFlangeRect(p1, vx, vy, a, d);
		drawRectAsThinLines(p1, vx, vy, a, d);

		p1.set(x1 + h, y2 - e - a, z1);
		p2.set(x1 + h, y2 - e - a, z1 + d);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + h, y2 - e,     z1);
		p2.set(x1 + h, y2 - e - a, z1);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);
	}

	// now a bit more complicated one 
	if( (b > h) && (d <= g) )
	{
		// left box
		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
		p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
		p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + g);
		FdPoint3d centralPointsLB[3] = { p1, p2, p3 };
		double tabWidthLB[3] = { a, a, a };  // remember how perpVector works
		double tabHeightLB[3] = { b, b, b };
		bool sidesLB[8] = { true, true, true, true,
		                    true, true, true, true };
		bool conLB[2] = { false, false };
		makeBox(2, centralPointsLB, tabWidthLB, tabHeightLB, sidesLB, conLB, false, false);

		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
		addRectangularConnector(p1, -vz, vy, a + 2 * flange_2, b + 2 * flange_2);
		makeRectangularFlange(p1, -vz, vy, a, b, flange_2);

		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
		addSymbolicFlangeRect(p1, -vz, vy, a, b);
		drawRectAsThinLines(p1, -vz, vy, a, b);

        p1.set(x1, y2 - e,     z1 + g);
		p2.set(x1, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1,     y2 - e - a, z1 + g);
		p2.set(x1 + b, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		// the hole between left and right box
		p1.set(x1 + h + (b - h) / 2.0, y2 - e - a / 2.0, z1 + g);
		p2.set(x1 + h + (b - h) / 2.0, y2 - e - a / 2.0, z1 + d);
		FdPoint3d centralPointsHB[2] = { p1, p2 };
		double tabWidthHB[2] = { a, a };  // remember how perpVector works
		double tabHeightHB[2] = { b - h, b - h };
		bool sidesHB[4] = { false, true, true, true };
		bool conHB[2] = { false, false };
		makeBox(1, centralPointsHB, tabWidthHB, tabHeightHB, sidesHB, conHB, false, false);

		p1.set(x1 + h,           y2 - e - a, z1 + d);
		p2.set(x1 + h + (b - h), y2 - e - a, z1 + d);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + h,           y2 - e, z1 + d);
		p2.set(x1 + h + (b - h), y2 - e, z1 + d);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + h,           y2 - e - a, z1 + g);
		p2.set(x1 + h + (b - h), y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + h,           y2 - e, z1 + g);
		p2.set(x1 + h + (b - h), y2 - e, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1,     y2 - e - a, z1 + g);
		p2.set(x1 + b, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + b, y2 - e,     z1 + g);
		p2.set(x1 + b, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		// right box - it has to have two segments :)
		p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
		p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
		p3.set(x1 + b,        y2 - e - a / 2.0, z1 + d / 2.0);
		p4.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
		FdPoint3d centralPointsRB[4] = { p1, p2, p3, p4 };
		FdVector3d vectorsRB[4] = { -vx, -vx, -vx, -vx };
		double tabWidthRB[4] = { d, d, d, d };
		double tabHeightRB[4] = { a, a, a, a };
		bool sidesRB[12] = { true, true,  true, true,
		                     true, true,  true, true,
		                     true, false, true, true };
		bool conRB[2] = { false, false };
		bool edgesRB[7][4] = { true,  true,  true,  true,
		                       true,  true,  true,  true,
		                       true,  true,  true,  true,
		                       true,  true,  true,  true,
		                       false, true,  false, false,
		                       true,  true,  true,  true,
		                       false, false, false, false };
		makeBox(3, centralPointsRB, vectorsRB, tabWidthRB, tabHeightRB, sidesRB, edgesRB, conRB, false, false);

		p1.set(x2, y2 - e - a / 2.0, z1 + d / 2.0);
		addRectangularConnector(p1, vx, vy, a + 2 * flange_3, d + 2 * flange_3);
		makeRectangularFlange(p1, vx, vy, a, d, flange_3);

		p1.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
		addSymbolicFlangeRect(p1, vx, vy, a, d);
		drawRectAsThinLines(p1, vx, vy, a, d);

		p1.set(x1 + h, y2 - e - a, z1);
		p2.set(x1 + h, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + h, y2 - e,     z1);
		p2.set(x1 + h, y2 - e - a, z1);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);
	}

	if( (b <= h) && (d > g) )
	{
		// left box - made from 2 segments
		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
		p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
		p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + d);
		p4.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + g);
		FdPoint3d centralPointsLB[4] = { p1, p2, p3, p4 };
		double tabWidthLB[4] = { a, a, a, a };  // remember how perpVector works
		double tabHeightLB[4] = { b, b, b, b };
		bool sidesLB[12] = { true, true, true,  true,
		                     true, true, true,  true,
		                     true, true, false, true };
		bool conLB[2] = { false, false };
		makeBox(3, centralPointsLB, tabWidthLB, tabHeightLB, sidesLB, conLB, false, false);

		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
		addRectangularConnector(p1, -vz, vy, a + 2 * flange_2, b + 2 * flange_2);
		makeRectangularFlange(p1, -vz, vy, a, b, flange_2);

		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
		addSymbolicFlangeRect(p1, -vz, vy, a, b);
		drawRectAsThinLines(p1, -vz, vy, a, b);

		p1.set(x1, y2 - e,     z1 + g);
		p2.set(x1, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1,     y2 - e - a, z1 + g);
		p2.set(x1 + h, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		// the hole between left and right box
		p1.set(x1 + h, y2 - e - a / 2.0, z1 + g + (d - g) / 2.0);
		p2.set(x1 + b, y2 - e - a / 2.0, z1 + g + (d - g) / 2.0);
		FdPoint3d centralPointsHB[2] = { p1, p2 };
		double tabWidthHB[2] = { d - g, d - g };  // remember how perpVector works
		double tabHeightHB[2] = { a, a };
		bool sidesHB[4] = { true, true, true, false };
		bool conHB[2] = { false, false };
		makeBox(1, centralPointsHB, tabWidthHB, tabHeightHB, sidesHB, conHB, false, false);

		p1.set(x1 + h, y2 - e - a, z1 + g + (d - g));
		p2.set(x1 + h, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + h, y2 - e, z1 + g + (d - g));
		p2.set(x1 + h, y2 - e, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + b, y2 - e - a, z1 + g + (d - g));
		p2.set(x1 + b, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + b, y2 - e, z1 + g + (d - g));
		p2.set(x1 + b, y2 - e, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + h, y2 - e - a, z1 + g + (d - g));
		p2.set(x1 + h, y2 - e,     z1 + g + (d - g));
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		// right box
		p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
		p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
		p3.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0); 
		FdPoint3d centralPointsRB[3] = { p1, p2, p3 };
		double tabWidthRB[3] = { d, d, d };
		double tabHeightRB[3] = { a, a, a };
		bool sidesRB[8] = { true, true, true, true,
		                    true, true, true, true };
		bool conRB[2] = { false, false };
		makeBox(2, centralPointsRB, tabWidthRB, tabHeightRB, sidesRB, conRB, false, false);

		p1.set(x2, y2 - e - a / 2.0, z1 + d / 2.0);
		addRectangularConnector(p1, vx, vy, a + 2 * flange_3, d + 2 * flange_3);
		makeRectangularFlange(p1, vx, vy, a, d, flange_3);

		p1.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
		addSymbolicFlangeRect(p1, vx, vy, a, d);
		drawRectAsThinLines(p1, vx, vy, a, d);

		p1.set(x1 + h, y2 - e - a, z1);
		p2.set(x1 + h, y2 - e - a, z1 + d);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + h, y2 - e, z1);
		p2.set(x1 + h, y2 - e - a, z1);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);
	}

	// last case, when both bottom boxes have bigger dimensions than the upper one 
	if( (b > h) && (d > g) )
	{
		// left box - made from 1 segment
		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
		p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
		p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + d);

		FdPoint3d centralPointsLB[3] = { p1, p2, p3 };
		double tabWidthLB[3] = { a, a, a };  // remember how perpVector works
		double tabHeightLB[3] = { b, b, b };
		bool sidesLB[8] = { true, true, true, true,
		                    true, true, true, true };
		bool conLB[2] = { false, false };
		makeBox(2, centralPointsLB, tabWidthLB, tabHeightLB, sidesLB, conLB, false, false);

		bool sideser1[4] = { true, true, true, true };
		addEraseRect(p3, -vz, vy,  a, b, sideser1);

		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
		addRectangularConnector(p1, -vz, vy, a + 2 * flange_2, b + 2 * flange_2);
		makeRectangularFlange(p1, -vz, vy, a, b, flange_2);

		p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
		addSymbolicFlangeRect(p1, -vz, vy, a, b);
		drawRectAsThinLines(p1, -vz, vy, a, b);

		p1.set(x1, y2 - e,     z1 + g);
		p2.set(x1, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1,     y2 - e - a, z1 + g);
		p2.set(x1 + b, y2 - e - a, z1 + g);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		// left box - made from 1 segment - this is a box closer to inner box
		p1.set(x1 + h / 2.0, y2 - e - a / 2.0, z1 + d);
		p2.set(x1 + h / 2.0, y2 - e - a / 2.0, z1 + g);
		FdPoint3d centralPointsLFB[2] = { p1, p2 };
		double tabWidthLFB[2] = { a, a };  // remember how perpVector works
		double tabHeightLFB[2] = { h, h };
		bool sidesLFB[4] = { true, true, false, true };
		bool conLFB[2] = { false, false };
		makeBox(1, centralPointsLFB, tabWidthLFB, tabHeightLFB, sidesLFB, conLFB, false, false);

		// right box
		p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
		p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
		p3.set(x1 + b,        y2 - e - a / 2.0, z1 + d / 2.0);
		p4.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
		FdPoint3d centralPointsRB[4] = { p1, p2, p3, p4 };
		double tabWidthRB[4] = { d, d, d, d };
		double tabHeightRB[4] = { a, a, a, a };
		bool sidesRB[12] = { true, true,  true, true,
		                     true, true,  true, true,
		                     true, false, true, true };
		bool conRB[2] = { false, false };
		makeBox(3, centralPointsRB, tabWidthRB, tabHeightRB, sidesRB, conRB, false, false);

		bool sideser2[4] = { true, true, true, true };
		addEraseRect(p3, vx, vy, a, d, sideser2);

		p1.set(x2, y2 - e - a / 2.0, z1 + d / 2.0);
		addRectangularConnector(p1, vx, vy, a + 2 * flange_3, d + 2 * flange_3);
		makeRectangularFlange(p1, vx, vy, a, d, flange_3);

		p1.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
		addSymbolicFlangeRect(p1, vx, vy, a, d);
		drawRectAsThinLines(p1, vx, vy, a, d);

		p1.set(x1 + h, y2 - e - a, z1);
		p2.set(x1 + h, y2 - e - a, z1 + d);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + h, y2 - e, z1);
		p2.set(x1 + h, y2 - e - a, z1);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);

		p1.set(x1 + h, y2 - e, z1 + h);
		p2.set(x1 + h, y2 - e, z1 + d);
		// makeSymbolicLine(p1, p2);
		addEraseLine(p1, p2);
	}

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyd = d, copyg = g, copyh = h, copye = e;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		a += 2 * size;  b += 2 * size;  d += 2 * size;  h += 2 * size;  g += 2 * size;
		e -=size;

		// the main idea is that we have a few boxes here:)
		double x1 = -max(h, b) / 2.0,                y1 = -a / 2.0,                z1 = -max(d, g) / 2.0;
		double x2 =  max(h, b) / 2.0 + e /* + fo */, y2 =  a / 2.0 + e /* + fo */, z2 =  max(d, g) / 2.0 + e /* + fo */;

		// first one is the easiest - the one on the top - it consist of one or two boxes depending on a situation
		// and one of the boxes has 2 segments
		FdPoint3d p1, p2, p3, p4;
		p1.set(x1 + h / 2.0,  y2,            z1 + g / 2.0);
		p2.set(x1 + h / 2.0,  y2 - BSFlange, z1 + g / 2.0);
		p3.set(x1 + h / 2.0,  y2 - e,        z1 + g / 2.0);
		p4.set(x1 + h / 2.0,  y1,            z1 + g / 2.0);
		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d vectors[4] = { -vy, -vy, -vy, -vy };
		FdVector3d upVectors[4] = { -vy.perpVector(), -vy.perpVector(), -vy.perpVector(), -vy.perpVector() };
		double tabWidth[4] = { g, g, g, g };
		double tabHeight[4] = { h, h, h, h };
		bool sides[12] = { true,  true,  true, true,
		                   true,  true,  true, true,
		                   false, false, true, true };
		bool edges[7][4] = { true, true, true,  true,
		                     true, true, true,  true,
		                     true, true, true,  true,
		                     true, true, true,  true,
		                     true, true, false, false,
		                     true, true, true,  true,
		                     true, true, true,  true };
		makeBox(3, cp, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, true, (size > flange_1) ? 0 : 5, 5, flange_1 - size);

		double xOff = max(h, b) / 2 + e, zOff = max(d, g) / 2.0 + e, yOff = a / 2 + e;

		// so first we consider the simplest situation
		if( (b <= h) && (d <= g) )
		{
			//small corner
			p1.set(x1 + b + (h - b) / 2.0,  y2 - e, z1 + d + (g - d) / 2.0);
			p2.set(x1 + b + (h - b) / 2.0,  y1,     z1 + d + (g - d) / 2.0);
			FdPoint3d centralPointsC[2] = { p1, p2 };
			double tabWidthC[2] = { g - d, g - d };
			double tabHeightC[2] = { h - b, h - b };
			bool sidesC[4] = { true, true, false, false };
			bool conC[2] = { false, false };
			makeBox(1, centralPointsC, tabWidthC, tabHeightC, sidesC, conC, false, false);

			// left box
			p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
			p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
			p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + g);
			FdPoint3d centralPointsLB[3] = { p1, p2, p3 };
			FdVector3d vectorsLB[3] = { vz, vz, vz };
			FdVector3d upVectorsLB[3] = { vx, vx, vx };
			double tabWidthLB[3] = { a, a, a };  // remember how perpVector works
			double tabHeightLB[3] = { b, b, b };
			bool sidesLB[8] = { true, true, true, true,
			                    true, true, true, true };
			makeBox(2, centralPointsLB, vectorsLB, upVectorsLB, tabWidthLB, tabHeightLB, sidesLB, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);

			// right box
			p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
			p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
			p3.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
			FdPoint3d centralPointsRB[3] = { p1, p2, p3 };
			FdVector3d vectorRB[3] = { vx, vx, vx };
			FdVector3d upVectorRB[3] = { vy, vy, vy };
			double tabWidthRB[3] = { d, d, d };
			double tabHeightRB[3] = { a, a, a };
			bool sidesRB[8] = { true, true, true, true,
			                    true, true, true, true };
			makeBox(2, centralPointsRB, vectorRB, upVectorRB, tabWidthRB, tabHeightRB, sidesRB, false, false, (size > flange_3) ? 0 : 5, 5, flange_3 - size);
		}

		// now a bit more complicated one
		if( (b > h) && (d <= g) )
		{
			// left box
			p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
			p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
			p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + g);
			FdPoint3d centralPointsLB[3] = { p1, p2, p3 };
			FdVector3d vectorsLB[3] = { vz, vz, vz };
			FdVector3d upVectorsLB[3] = { vx, vx, vx };
			double tabWidthLB[3] = { a, a, a };  // remember how perpVector works
			double tabHeightLB[3] = { b, b, b };
			bool sidesLB[8] = { true, true, true, true,
			                    true, true, true, true };
			bool conLB[2] = { true, false };
			makeBox(2, centralPointsLB, vectorsLB, upVectorsLB, tabWidthLB, tabHeightLB, sidesLB, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);

			// the hole between left and right box
			p1.set(x1 + h + (b - h) / 2.0, y2 - e - a / 2.0, z1 + g);
			p2.set(x1 + h + (b - h) / 2.0, y2 - e - a / 2.0, z1 + d);
			FdPoint3d centralPointsHB[2] = { p1, p2 };
			double tabWidthHB[2] = { a, a };  // remember how perpVector works
			double tabHeightHB[2] = { b - h, b - h };
			bool sidesHB[4] = { false, true, true, true };
			bool conHB[2] = { false, false };
			makeBox(1, centralPointsHB, tabWidthHB, tabHeightHB, sidesHB, conHB, false, false);

			// right box - it has to have two segments :)
			p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
			p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
			p3.set(x1 + b,        y2 - e - a / 2.0, z1 + d / 2.0);
			p4.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
			FdPoint3d centralPointsRB[4] = { p1, p2, p3, p4 };
			FdVector3d vectorsRB[4] = { vx, vx, vx, vx };
			FdVector3d upVectorRB[4] = { vy, vy, vy, vy };
			double tabWidthRB[4] = { d, d, d, d };
			double tabHeightRB[4] = { a, a, a, a };
			bool sidesRB[12] = { true, true,  true, true,
			                     true, true,  true, true,
			                     true, false, true, true };
			bool edgesRB[7][4] = { true,  true,  true,  true,
			                       true,  true,  true,  true,
			                       true,  true,  true,  true,
			                       true,  true,  true,  true,
			                       false, true,  false, false,
			                       true,  true,  true,  true,
			                       false, false, false, false };
			makeBox(3, centralPointsRB, vectorsRB, upVectorRB, tabWidthRB, tabHeightRB, sidesRB, edgesRB, false, false, (size > flange_3) ? 0 : 5, 5, flange_3 - size);
		}

		if( (b <= h) && (d > g) )
		{
			// left box - made from 2 segments
			p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
			p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
			p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + d);
			p4.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + g);
			FdPoint3d centralPointsLB[4] = { p1, p2, p3, p4 };
			FdVector3d vectorsLB[4] = { vz, vz, vz, vz };
			FdVector3d upVectorsLB[4] = { vx, vx, vx, vx };
			double tabWidthLB[4] = { a, a, a, a };  // remember how perpVector works
			double tabHeightLB[4] = { b, b, b, b };
			bool sidesLB[12] = { true, true, true,  true,
			                     true, true, true,  true,
			                     true, true, false, true };
			makeBox(3, centralPointsLB, vectorsLB, upVectorsLB, tabWidthLB, tabHeightLB, sidesLB, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);

			// the hole between left and right box
			p1.set(x1 + h, y2 - e - a / 2.0, z1 + g + (d - g) / 2.0);
			p2.set(x1 + b, y2 - e - a / 2.0, z1 + g + (d - g) / 2.0);
			FdPoint3d centralPointsHB[2] = { p1, p2 };
			double tabWidthHB[2] = { d - g, d - g };  // remember how perpVector works
			double tabHeightHB[2] = { a, a };
			bool sidesHB[4] = { true, true, true, false };
			bool conHB[2] = { false, false };
			makeBox(1, centralPointsHB, tabWidthHB, tabHeightHB, sidesHB, conHB, false, false);

			// right box
			p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
			p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
			p3.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
			FdPoint3d centralPointsRB[3] = { p1, p2, p3 };
			FdVector3d vectorsRB[3] = { vx, vx, vx };
			FdVector3d upVectorRB[3] = { vy, vy, vy };
			double tabWidthRB[3] = { d, d, d };
			double tabHeightRB[3] = { a, a, a };
			bool sidesRB[8] = { true, true, true, true,
			                    true, true, true, true };
			bool conRB[2] = { true, false };
			makeBox(2, centralPointsRB, vectorsRB, upVectorRB, tabWidthRB, tabHeightRB, sidesRB, false, false, (size > flange_3) ? 0 : 5, 5, flange_3 - size);
		}

		// last case, when both bottom boxes have bigger dimensions than the upper one
		if( (b > h) && (d > g) )
		{
			// left box - made from 1 segment
			p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
			p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
			p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + d);
			FdPoint3d centralPointsLB[3] = { p1, p2, p3 };
			FdVector3d vectorsLB[3] = { vz, vz, vz };
			FdVector3d upVectorsLB[3] = { vx, vx, vx };
			double tabWidthLB[3] = { a, a, a };  // remember how perpVector works
			double tabHeightLB[3] = { b, b, b };
			bool sidesLB[8] = { true, true, true, true,
			                    true, true, true, true };
			makeBox(2, centralPointsLB, vectorsLB, upVectorsLB, tabWidthLB, tabHeightLB, sidesLB, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);

			// left box - made from 1 segment - this is a box closer to inner box
			p1.set(x1 + h / 2.0, y2 - e - a / 2.0, z1 + d);
			p2.set(x1 + h / 2.0, y2 - e - a / 2.0, z1 + g);
			FdPoint3d centralPointsLFB[2] = { p1, p2 };
			double tabWidthLFB[2] = { a, a };  // remember how perpVector works
			double tabHeightLFB[2] = { h, h };
			bool sidesLFB[4] = { true, true, false, true };
			bool conLFB[2] = { false, false };
			makeBox(1, centralPointsLFB, tabWidthLFB, tabHeightLFB, sidesLFB, conLFB, false, false);

			// right box
			p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
			p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
			p3.set(x1 + b,        y2 - e - a / 2.0, z1 + d / 2.0);
			p4.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
			FdPoint3d centralPointsRB[4] = { p1, p2, p3, p4 };
			FdVector3d vectorsRB[4] = { vx, vx, vx, vx };
			FdVector3d upVectorRB[4] = { vy, vy, vy, vy };
			double tabWidthRB[4] = { d, d, d, d };
			double tabHeightRB[4] = { a, a, a, a };
			bool sidesRB[12] = { true, true,  true, true,
			                     true, true,  true, true,
			                     true, false, true, true };
			makeBox(3, centralPointsRB, vectorsRB, upVectorRB, tabWidthRB, tabHeightRB, sidesRB, false, false, (size > flange_3) ? 0 : 5, 5, flange_3 - size);
		}
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  g = copyg;  h = copyh;  e = copye;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		a -= 2 * size;  b -= 2 * size;  d -= 2 * size;  h -= 2 * size;  g -= 2 * size;
		e += size;

		// the main idea is that we have a few boxes here:)
		double x1 = -max(h, b) / 2.0,                y1 = -a / 2.0,                z1 = -max(d, g) / 2.0;
		double x2 =  max(h, b) / 2.0 + e /* + fo */, y2 =  a / 2.0 + e /* + fo */, z2 =  max(d, g) / 2.0 + e /* + fo */;

		// first one is the easiest - the one on the top - it consist of one or two boxes depending on a situation
		// and one of the boxes has 2 segments
		FdPoint3d p1, p2, p3, p4;
		p1.set(x1 + h / 2.0,  y2,            z1 + g / 2.0);
		p2.set(x1 + h / 2.0,  y2 - BSFlange, z1 + g / 2.0);
		p3.set(x1 + h / 2.0,  y2 - e,        z1 + g / 2.0);
		p4.set(x1 + h / 2.0,  y1,            z1 + g / 2.0);
		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d vectors[4] = { -vy, -vy, -vy, -vy };
		FdVector3d upVectors[4] = { -vy.perpVector(), -vy.perpVector(), -vy.perpVector(), -vy.perpVector() };
		double tabWidth[4] = { g, g, g, g };
		double tabHeight[4] = { h, h, h, h };
		bool sides[12] = { true,  true,  true, true,
		                   true,  true,  true, true,
		                   false, false, true, true };
		bool edges[7][4] = { true, true, true,  true,
		                     true, true, true,  true,
		                     true, true, true,  true,
		                     true, true, true,  true,
		                     true, true, false, false,
		                     true, true, true,  true,
		                     true, true, true,  true };
		makeBox(3, cp, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, true, 0, 5, size);

		double xOff = max(h, b) / 2 + e, zOff = max(d, g) / 2.0 + e, yOff = a / 2 + e;

		// so first we consider the simplest situation
		if( (b <= h) && (d <= g) )
		{
			// small corner
			p1.set(x1 + b + (h - b) / 2.0,  y2 - e, z1 + d + (g - d) / 2.0);
			p2.set(x1 + b + (h - b) / 2.0,  y1,     z1 + d + (g - d) / 2.0);
			FdPoint3d centralPointsC[2] = { p1, p2 };
			double tabWidthC[2] = { g - d, g - d };
			double tabHeightC[2] = { h - b, h - b };
			bool sidesC[4] = { true, true, false, false };
			bool conC[2] = { false, false };
			makeBox(1, centralPointsC, tabWidthC, tabHeightC, sidesC, conC, false, false);

			// left box
			p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
			p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
			p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + g);
			FdPoint3d centralPointsLB[3] = { p1, p2, p3 };
			FdVector3d vectorsLB[3] = { vz, vz, vz };
			FdVector3d upVectorsLB[3] = { vx, vx, vx };
			double tabWidthLB[3] = { a, a, a };  // remember how perpVector works
			double tabHeightLB[3] = { b, b, b };
			bool sidesLB[8] = { true, true, true, true,
			                    true, true, true, true };
			makeBox(2, centralPointsLB, vectorsLB, upVectorsLB, tabWidthLB, tabHeightLB, sidesLB, false, false, 0, 5, size);

			// right box
			p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
			p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
			p3.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
			FdPoint3d centralPointsRB[3] = { p1, p2, p3 };
			FdVector3d vectorRB[3] = { vx, vx, vx };
			FdVector3d upVectorRB[3] = { vy, vy, vy };
			double tabWidthRB[3] = { d, d, d };
			double tabHeightRB[3] = { a, a, a };
			bool sidesRB[8] = { true, true, true, true,
			                    true, true, true, true };
			makeBox(2, centralPointsRB, vectorRB, upVectorRB, tabWidthRB, tabHeightRB, sidesRB, false, false, 0, 5, size);
		}

		// now a bit more complicated one
		if( (b > h) && (d <= g) )
		{
			// left box
			p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
			p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
			p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + g);
			FdPoint3d centralPointsLB[3] = { p1, p2, p3 };
			FdVector3d vectorsLB[3] = { vz, vz, vz };
			FdVector3d upVectorsLB[3] = { vx, vx, vx };
			double tabWidthLB[3] = { a, a, a };  // remember how perpVector works
			double tabHeightLB[3] = { b, b, b };
			bool sidesLB[8] = { true, true, true, true,
			                    true, true, true, true };
			bool conLB[2] = { true, false };
			makeBox(2, centralPointsLB, vectorsLB, upVectorsLB, tabWidthLB, tabHeightLB, sidesLB, false, false, 0, 5, size);

			// the hole between left and right box
			p1.set(x1 + h + (b - h) / 2.0, y2 - e - a / 2.0, z1 + g);
			p2.set(x1 + h + (b - h) / 2.0, y2 - e - a / 2.0, z1 + d);
			FdPoint3d centralPointsHB[2] = { p1, p2 };
			double tabWidthHB[2] = { a, a };  // remember how perpVector works
			double tabHeightHB[2] = { b - h, b - h };
			bool sidesHB[4] = { false, true, true, true };
			bool conHB[2] = { false, false };
			makeBox(1, centralPointsHB, tabWidthHB, tabHeightHB, sidesHB, conHB, false, false);

			// right box - it has to have two segments :)
			p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
			p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
			p3.set(x1 + b,        y2 - e - a / 2.0, z1 + d / 2.0);
			p4.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
			FdPoint3d centralPointsRB[4] = { p1, p2, p3, p4 };
			FdVector3d vectorsRB[4] = { vx, vx, vx, vx };
			FdVector3d upVectorRB[4] = { vy, vy, vy, vy };
			double tabWidthRB[4] = { d, d, d, d };
			double tabHeightRB[4] = { a, a, a, a };
			bool sidesRB[12] = { true, true,  true, true,
			                     true, true,  true, true,
			                     true, false, true, true };
			bool edgesRB[7][4] = { true,  true,  true,  true,
			                       true,  true,  true,  true,
			                       true,  true,  true,  true,
			                       true,  true,  true,  true,
			                       false, true,  false, false,
			                       true,  true,  true,  true,
			                       false, false, false, false };
			makeBox(3, centralPointsRB, vectorsRB, upVectorRB, tabWidthRB, tabHeightRB, sidesRB, edgesRB, false, false, 0, 5, size);
		}

		if( (b <= h) && (d > g) )
		{
			// left box - made from 2 segments
			p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
			p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
			p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + d);
			p4.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + g);
			FdPoint3d centralPointsLB[4] = { p1, p2, p3, p4 };
			FdVector3d vectorsLB[4] = { vz, vz, vz, vz };
			FdVector3d upVectorsLB[4] = { vx, vx, vx, vx };
			double tabWidthLB[4] = { a, a, a, a };  // remember how perpVector works
			double tabHeightLB[4] = { b, b, b, b };
			bool sidesLB[12] = { true, true, true,  true,
			                     true, true, true,  true,
			                     true, true, false, true };
			makeBox(3, centralPointsLB, vectorsLB, upVectorsLB, tabWidthLB, tabHeightLB, sidesLB, false, false, 0, 5, size);

			// the hole between left and right box
			p1.set(x1 + h, y2 - e - a / 2.0, z1 + g + (d - g) / 2.0);
			p2.set(x1 + b, y2 - e - a / 2.0, z1 + g + (d - g) / 2.0);
			FdPoint3d centralPointsHB[2] = { p1, p2 };
			double tabWidthHB[2] = { d - g, d - g };  // remember how perpVector works
			double tabHeightHB[2] = { a, a };
			bool sidesHB[4] = { true, true, true, false };
			bool conHB[2] = { false, false };
			makeBox(1, centralPointsHB, tabWidthHB, tabHeightHB, sidesHB, conHB, false, false);

			// right box
			p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
			p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
			p3.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
			FdPoint3d centralPointsRB[3] = { p1, p2, p3 };
			FdVector3d vectorsRB[3] = { vx, vx, vx };
			FdVector3d upVectorRB[3] = { vy, vy, vy };
			double tabWidthRB[3] = { d, d, d };
			double tabHeightRB[3] = { a, a, a };
			bool sidesRB[8] = { true, true, true, true,
			                    true, true, true, true };
			bool conRB[2] = { true, false };
			makeBox(2, centralPointsRB, vectorsRB, upVectorRB, tabWidthRB, tabHeightRB, sidesRB, false, false, 0, 5, size);
		}

		// last case, when both bottom boxes have bigger dimensions than the upper one
		if( (b > h) && (d > g) )
		{
			// left box - made from 1 segment
			p1.set(x1 + b / 2.0, y2 - e - a / 2.0, z2);
			p2.set(x1 + b / 2.0, y2 - e - a / 2.0, z2 - BSFlange);
			p3.set(x1 + b / 2.0, y2 - e - a / 2.0, z1 + d);
			FdPoint3d centralPointsLB[3] = { p1, p2, p3 };
			FdVector3d vectorsLB[3] = { vz, vz, vz };
			FdVector3d upVectorsLB[3] = { vx, vx, vx };
			double tabWidthLB[3] = { a, a, a };  // remember how perpVector works
			double tabHeightLB[3] = { b, b, b };
			bool sidesLB[8] = { true, true, true, true,
			                    true, true, true, true };
			makeBox(2, centralPointsLB, vectorsLB, upVectorsLB, tabWidthLB, tabHeightLB, sidesLB, false, false, 0, 5, size);

			// left box - made from 1 segment - this is a box closer to inner box
			p1.set(x1 + h / 2.0, y2 - e - a / 2.0, z1 + d);
			p2.set(x1 + h / 2.0, y2 - e - a / 2.0, z1 + g);
			FdPoint3d centralPointsLFB[2] = { p1, p2 };
			double tabWidthLFB[2] = { a, a };  // remember how perpVector works
			double tabHeightLFB[2] = { h, h };
			bool sidesLFB[4] = { true, true, false, true };
			bool conLFB[2] = { false, false };
			makeBox(1, centralPointsLFB, tabWidthLFB, tabHeightLFB, sidesLFB, conLFB, false, false);

			// right box
			p1.set(x2,            y2 - e - a / 2.0, z1 + d / 2.0);
			p2.set(x2 - BSFlange, y2 - e - a / 2.0, z1 + d / 2.0);
			p3.set(x1 + b,        y2 - e - a / 2.0, z1 + d / 2.0);
			p4.set(x1 + h,        y2 - e - a / 2.0, z1 + d / 2.0);
			FdPoint3d centralPointsRB[4] = { p1, p2, p3, p4 };
			FdVector3d vectorsRB[4] = { vx, vx, vx, vx };
			FdVector3d upVectorRB[4] = { vy, vy, vy, vy };
			double tabWidthRB[4] = { d, d, d, d };
			double tabHeightRB[4] = { a, a, a, a };
			bool sidesRB[12] = { true, true,  true, true,
			                     true, true,  true, true,
			                     true, false, true, true };
			makeBox(3, centralPointsRB, vectorsRB, upVectorRB, tabWidthRB, tabHeightRB, sidesRB, false, false, 0, 5, size);
		}
	}
}

void GLERectangular :: makeTR7(double a, double b, double d, double g, double r, double l, double n, double flange_1, double flange_2, double flange_3)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);
	postTransformMesh(M_PI,     FdVector3d::kZAxis);
	l = l - 2 * fo;

	// box
	FdPoint3d p1, p2, p3, p4;
	p1.set(-l / 2.0 - fo,    0, -b / 2.0 + d / 2.0);
	p2.set(-l / 2.0,         0, -b / 2.0 + d / 2.0);
	p3.set( l / 2.0 - r - g, 0, -b / 2.0 + d / 2.0);
	p4.set( l / 2.0,         0, -b / 2.0 + d / 2.0);
	FdPoint3d centralPoints[4] = { p1, p2, p3, p4 };
    FdVector3d vectors[4] = { vx, vx, vx, vx };
	double tabWidth[4] = { d, d, d, d };
	double tabHeight[4] = { a, a, a, a };
	bool sides[12] = { true, true,  true, true,
	                   true, true,  true, true,
	                   true, false, true, true };
	bool con[2] = { false, false };
	bool edges[7][4] = { true,  true,  true,  true,
	                     true,  true,  true,  true,
	                     true,  true,  true,  true,
	                     true,  true,  true,  true,
	                     false, false, false, false,
	                     true,  true,  true,  true,
	                     true,  true,  true,  true };
	makeBox(3, centralPoints, vectors, tabWidth, tabHeight, sides, edges, con, false, false);

	// bend attatched to the box...done twice to prevent gouraud shading issues
	p1.set( l / 2.0, 0, b / 2.0 - (b - d) / 2.0);
	bool sidesB[4] = { true, false, true, false };
	makeRectBend(p1, -vx, vz, sidesB, true, a, (b - d), g, n, r, false);
	bool sidesB2[4] = { false, true, false, true };
	makeRectBend(p1, -vx, vz, sidesB2, true, a, (b - d), g, n, r, false);

	// flange on right side
	p1.set( l / 2.0,      0, 0);
	p2.set( l / 2.0 + fo, 0, 0);
	FdPoint3d centralPointsC[2] = { p1, p2 };
	double tabWidthC[2] = { b, b };
	double tabHeightC[2] = { a, a };
	bool sidesC[4] = { true, true, true, true };
	bool conC[2] = { false, false };
	makeBox(1, centralPointsC, tabWidthC, tabHeightC, sidesC, conC, false, false);

	// flange at the end of the bend
	p1.set( l / 2.0 - r - g / 2.0, a / 2.0 + r,      b / 2.0 - (b - d) / 2.0);
	p2.set( l / 2.0 - r - g / 2.0, a / 2.0 + r + fo, b / 2.0 - (b - d) / 2.0);
	FdPoint3d centralPointsF[2] = { p1, p2 };
	double tabWidthF[2] = { (b - d), (b - d) };
	double tabHeightF[2] = { g, g };
	bool sidesF[4] = { true, true, true, true };
	bool conF[2] = { false, false };
	makeBox(1, centralPointsF, tabWidthF, tabHeightF, sidesF, conF, false, false);

	//---DEFINE LINE TYPES

	//---CENTER LINES:
	// center line for the main box
	p1.set(-l / 2.0 - fo, 0, -b / 2.0 + d / 2.0);
	p2.set( l / 2.0 + fo, 0, -b / 2.0 + d / 2.0);
	addCenterLine(p1, p2);

	// center lines for the bend box
	p1.set( l / 2.0 - r - g / 2.0, 0,                b / 2.0 - (b - d) / 2.0);
	p2.set( l / 2.0 - r - g / 2.0, a / 2.0 + r + fo, b / 2.0 - (b - d) / 2.0);
	addCenterLine(p1, p2);

	p1.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 - (b - d) / 2.0);
	p2.set( l / 2.0 + fo,          0, b / 2.0 - (b - d) / 2.0);
	addCenterLine(p1, p2);

	//---CONNECTOR LINES:
	// left connector
	p1.set(-l / 2.0 - fo, 0, -b / 2.0 + d / 2.0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_2, d + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, d, flange_2);
	
	// right connector
	p1.set( l / 2 + fo, 0, 0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);

	// bend connector
	p1.set( l / 2.0 - r - g / 2.0, a / 2.0 + r + fo, b / 2.0 - (b - d) / 2.0);
	addRectangularConnector(p1, vy, vx, g + 2 * flange_3, b - d + 2 * flange_3);
	makeRectangularFlange(p1, vy, vx, g, b - d, flange_3);

	//---THIN LINES:
	p1.set(-l / 2.0, 0, -b / 2.0 + d / 2.0);
	addSymbolicFlangeRect(p1, vx, vy, a, d);

	p1.set( l / 2, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, a, b);

	p1.set( l / 2.0 - r - g / 2.0, a / 2.0 + r, b / 2.0 - (b - d) / 2.0);
	addSymbolicFlangeRect(p1, vy, vx, g, b - d);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyd = d, copyg = g, copyr = r, copyl = l;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		if( size >= r )
			{  size = r - 0.1;  };

		g += 2 * size;  a += 2 * size;  b += 2 * size;  d += 2 * size;
		r -= size;

		FdPoint3d p1, p2, p3, p4;
		p1.set(-l / 2.0 - fo,    0, -b / 2.0 + d / 2.0);
		p2.set(-l / 2.0,         0, -b / 2.0 + d / 2.0);
		p3.set( l / 2.0 - r - g, 0, -b / 2.0 + d / 2.0);
		p4.set( l / 2.0,         0, -b / 2.0 + d / 2.0);
		FdPoint3d centralPoints[4] = { p1, p2, p3, p4 };
		FdVector3d vectors[4] = { vx, vx, vx, vx };
		FdVector3d upVectors[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { d, d, d, d };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true,  true,  true, true,
		                   true,  true,  true, true,
		                   false, false, true, true };
		bool edges[7][4] = { true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     false, false, false, false,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true };
		makeBox(3, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);

		p4.set( l / 2.0 - (r + g) / 2, a / 2, -b / 2.0 + d / 2.0 - size / 2);
		makePlane(p4, vy, vx, g + r, d - size);

		// bend attatched to the box...done twice to prevent gouraud shading issues
		p1.set( l / 2.0, 0, b / 2.0 - (b - d) / 2.0 - size / 2);
		bool sidesB[4] = { true, false, false, false };
		makeRectBend(p1, -vx, vz, sidesB, true, a, (b - d) + size, g, n, r, false);
		bool sidesB2[4] = { false, true, false, true };
		makeRectBend(p1, -vx, vz, sidesB2, true, a, (b - d) + size, g, n, r, false);

		// flange on right side
		p1.set( l / 2.0,      0, 0);
		p2.set( l / 2.0 + fo, 0, 0);
		FdPoint3d centralPointsC[2] = { p1, p2 };
		double tabWidthC[2] = { b, b };
		double tabHeightC[2] = { a, a };
		bool sidesC[4] = { true, true, true, true };
		makeBox(1, centralPointsC, vectors, upVectors, tabWidthC, tabHeightC, sidesC, false, false, 5, (size > flange_1) ? 0 : 5, flange_1 - size);

		// flange at the end of the bend
		p1.set( l / 2.0 - r - g / 2.0, a / 2.0 + r,      b / 2.0 - (b - d) / 2.0 - size);
		p2.set( l / 2.0 - r - g / 2.0, a / 2.0 + r + fo, b / 2.0 - (b - d) / 2.0 - size);
		FdPoint3d centralPointsF[2] = { p1, p2 };
		FdVector3d vb[2] = { vy, vy };
		FdVector3d upvb[2] = { vx, vx };
		double tabWidthF[2] = { (b - d) + 2 * size, (b - d) + 2 * size };
		double tabHeightF[2] = { g, g };
		bool sidesF[4] = { true, true, true, true };
		makeBox(1, centralPointsF, vb, upvb, tabWidthF, tabHeightF, sidesF, false, false, 5, (size > flange_3) ? 0 : 5, flange_3 - size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  g = copyg;  r = copyr;  l = copyl;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		g -= 2 * size;  a -= 2 * size;  b -= 2 * size;  d -= 2 * size;
		r += size;

		// box
		FdPoint3d p1, p2, p3, p4;
		p1.set(-l / 2.0 - fo,    0, -b / 2.0 + d / 2.0);
		p2.set(-l / 2.0,         0, -b / 2.0 + d / 2.0);
		p3.set( l / 2.0 - r - g, 0, -b / 2.0 + d / 2.0);
		p4.set( l / 2.0,         0, -b / 2.0 + d / 2.0);
		FdPoint3d centralPoints[4] = { p1, p2, p3, p4 };
		FdVector3d vectors[4] = { vx, vx, vx, vx };
		FdVector3d upVectors[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { d, d, d, d };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true, true,  true, true,
		                   true, true,  true, true,
		                   true, false, true, true };
		bool con[2] = { true, false };
		bool edges[7][4] = { true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     false, false, false, false,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true };
		makeBox(3, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, 0, 5, size);

		// bend attatched to the box...done twice to prevent gouraud shading issues
		p1.set( l / 2.0, 0, b / 2.0 - (b - d) / 2.0 + size);
		bool sidesB[4] = { true, false, true, false };
		makeRectBend(p1, -vx, vz, sidesB, true, a, (b - d) - 2 * size, g, n, r, false);
		bool sidesB2[4] = { false, true, false, true };
		makeRectBend(p1, -vx, vz, sidesB2, true, a, (b - d) - 2 * size, g, n, r, false);

		// flange on right side
		p1.set( l / 2.0,      0, 0);
		p2.set( l / 2.0 + fo, 0, 0);
		FdPoint3d centralPointsC[2] = { p1, p2 };
		double tabWidthC[2] = { b, b };
		double tabHeightC[2] = { a, a };
		bool sidesC[4] = { true, true, true, true };
		bool conC[2] = { false, true };
		makeBox(1, centralPointsC, vectors, upVectors, tabWidthC, tabHeightC, sidesC, false, false, 5, 0, size);

		// flange at the end of the bend
		p1.set( l / 2.0 - r - g / 2.0, a / 2.0 + r,      b / 2.0 - (b - d) / 2.0 + size);
		p2.set( l / 2.0 - r - g / 2.0, a / 2.0 + r + fo, b / 2.0 - (b - d) / 2.0 + size);
		FdPoint3d centralPointsF[2] = { p1, p2 };
		double tabWidthF[2] = { (b - d) - 2 * size, (b - d) - 2 * size };
		double tabHeightF[2] = { g, g };
		bool sidesF[4] = { true, true, true, true };
		bool conF[2] = { false, true };
		FdVector3d vectors2[4] = { vy, vy, vy, vy };
		FdVector3d upVectors2[4] = { vx, vx, vx, vx };
		makeBox(1, centralPointsF, vectors2, upVectors2, tabWidthF, tabHeightF, sidesF, false, false, 5, 0, size);
	}
}

void GLERectangular :: makeTR8(double a, double b, double d, double g, double r, double l, double n, double flange_1, double flange_2, double flange_3)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);
	l = l - 2 * fo;

	// box
	FdPoint3d p1, p2, p3, p4;
	p1.set(-l / 2.0,         0, -b / 2.0 + d / 2.0);
	p2.set(-l / 2.0 + r + g, 0, -b / 2.0 + d / 2.0);
	p3.set( l / 2.0,         0, -b / 2.0 + d / 2.0);
	p4.set( l / 2.0 + fo,    0, -b / 2.0 + d / 2.0);
	FdPoint3d centralPoints[4] = { p1, p2, p3, p4 };
	FdVector3d vectors[4] = { vx, vx, vx, vx };
	FdVector3d upVectors[4] = { vy, vy, vy, vy };

	double tabWidth[4] = { d, d, d, d };
	double tabHeight[4] = { a, a, a, a };
	bool sides[12] = { true, false, true, true,
	                   true, true,  true, true,
	                   true, true,  true, true };
	bool edges[7][4] = { true,  true,  true,  true,
	                     true,  true,  true,  true,
	                     false, false, false, false,
	                     true,  true,  true,  true,
	                     true,  true,  true,  true,
	                     true,  true,  true,  true,
	                     true,  true,  true,  true };
	makeBox(3, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, 5, 5, CONNECTOR_SIZE);

	//--- the bend... drawn twice to fix gouraud shading issues
	p1.set(-l / 2.0, 0, b / 2.0 - (b - d) / 2.0);
	bool sidesB[4] = { true, false, true, false };
	makeRectBend(p1, -vx, vz, sidesB, false, a, (b - d), g, n, r, false);
	bool sidesB2[4] = { false, true, false, true };
	makeRectBend(p1, -vx, vz, sidesB2, false, a, (b - d), g, n, r, false);

	// flange on left side
	p1.set(-l / 2.0,      0, 0);
	p2.set(-l / 2.0 - fo, 0, 0);
	FdPoint3d centralPointsC[2] = { p1, p2 };
	FdVector3d vectorC[2] = { vx, vx };
	FdVector3d upVectorC[2] = { vy, vy };
	double tabWidthC[2] = { b, b };
	double tabHeightC[2] = { a, a };
	bool sidesC[4] = { true, true, true, true };
	bool conC[2] = { false, true };
	makeBox(1, centralPointsC, vectorC, upVectorC, tabWidthC, tabHeightC, sidesC, false, false, 5, 5, CONNECTOR_SIZE);

	// flange at the end of the bend
	p1.set(-l / 2.0 + r + g / 2.0, a / 2.0 + r,      b / 2.0 - (b - d) / 2.0);
	p2.set(-l / 2.0 + r + g / 2.0, a / 2.0 + r + fo, b / 2.0 - (b - d) / 2.0);
	FdPoint3d centralPointsF[2] = { p1, p2 };
	FdVector3d vectorF[2] = { vy, vy };
	FdVector3d upVectorF[2] = { vx, vx };
	double tabWidthF[2] = { (b - d), (b - d) };
	double tabHeightF[2] = { g, g };
	bool sidesF[4] = { true, true, true, true };
	makeBox(1, centralPointsF, vectorF, upVectorF, tabWidthF, tabHeightF, sidesF, false, false, 5, 5, CONNECTOR_SIZE);


	//---DEFINE LINE TYPES
	//---CENTER LINES:
	// center line for the main box
	p1.set(-l / 2.0 - fo, 0, -b / 2.0 + d / 2.0);
	p2.set( l / 2.0 + fo, 0, -b / 2.0 + d / 2.0);
	addCenterLine(p1, p2);

	// center lines for the bend box
	p1.set(-l / 2.0 + r + g / 2.0, 0,                b / 2.0 - (b - d) / 2.0);
	p2.set(-l / 2.0 + r + g / 2.0, a / 2.0 + r + fo, b / 2.0 - (b - d) / 2.0);
	addCenterLine(p1, p2);

	p1.set(-l / 2.0 + r + g / 2.0, 0, b / 2.0 - (b - d) / 2.0);
	p2.set(-l / 2.0 - fo,          0, b / 2.0 - (b - d) / 2.0);
	addCenterLine(p1, p2);

	//---CONNECTOR LINES:
	// left connector
	p1.set( l / 2.0 + fo, 0, -b / 2.0 + d / 2.0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_2, d + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, d, flange_2);

	// right connector
	p1.set(-l / 2 - fo, 0, 0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);

	// bend connector
	p1.set(-l / 2.0 + r + g / 2.0, a / 2.0 + r + fo, b / 2.0 - (b - d) / 2.0);
	addRectangularConnector(p1, vy, vx, g + 2 * flange_3, b - d + 2 * flange_3);
	makeRectangularFlange(p1, vy, vx, g, b - d, flange_3);

	//--- THIN LINES:
	p1.set( l / 2.0, 0, -b / 2.0 + d / 2.0);
	addSymbolicFlangeRect(p1, vx, vy, a, d);

	p1.set(-l / 2, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, a, b);

	p1.set(-l / 2.0 + r + g / 2.0, a / 2.0 + r, b / 2.0 - (b - d) / 2.0);
	addSymbolicFlangeRect(p1, vy, vx, g, b - d);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyd = d, copyg = g, copyr = r, copyl = l;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		if( size >= r )
			{  size = r - 0.1;  };

		g += 2 * size;  a += 2 * size;  b += 2 * size;  d += 2 * size;
		r -= size;

		// box
		FdPoint3d p1, p2, p3, p4;
		p1.set(-l / 2.0,         0, -b / 2.0 + d / 2.0);
		p2.set(-l / 2.0 + r + g, 0, -b / 2.0 + d / 2.0);
		p3.set( l / 2.0,         0, -b / 2.0 + d / 2.0);
		p4.set( l / 2.0 + fo,    0, -b / 2.0 + d / 2.0);
		FdPoint3d centralPoints[4] = { p1, p2, p3, p4 };
		FdVector3d vectors[4] = { vx, vx, vx, vx };
		FdVector3d upVectors[4] = { vy, vy, vy, vy };

		double tabWidth[4] = { d, d, d, d };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { false, false, true, true,
		                   true,  true,  true, true,
		                   true,  true,  true, true };
		bool edges[7][4] = { true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     false, false, false, false,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true };
		makeBox(3, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, 5, (size > flange_2) ? 0 : 5, flange_2 - size);

		p4.set(-l / 2.0 + (r + g) / 2, a / 2, -b / 2.0 + d / 2.0 - size / 2);
		makePlane(p4, vy, vx, g + r, d - size);

		//--- the bend... drawn twice to fix gouraud shading issues
		p1.set(-l / 2.0, 0, b / 2.0 - (b - d) / 2.0 - size / 2);
		bool sidesB[4] = { true, false, false, false };
		makeRectBend(p1, -vx, vz, sidesB, false, a, (b - d) + size, g, n, r, false);
		bool sidesB2[4] = { false, true, false, true };
		makeRectBend(p1, -vx, vz, sidesB2, false, a, (b - d) + size, g, n, r, false);

		// flange on left side
		p1.set(-l / 2.0,      0, 0);
		p2.set(-l / 2.0 - fo, 0, 0);
		FdPoint3d centralPointsC[2] = { p1, p2 };
		FdVector3d vectorC[2] = { vx, vx };
		FdVector3d upVectorC[2] = { vy, vy };
		double tabWidthC[2] = { b, b };
		double tabHeightC[2] = { a, a };
		bool sidesC[4] = { true, true, true, true };
		bool conC[2] = { false, true };
		makeBox(1, centralPointsC, vectorC, upVectorC, tabWidthC, tabHeightC, sidesC, false, false, 5, (size > flange_1) ? 0 : 5, flange_1 - size);

		// flange at the end of the bend
		p1.set(-l / 2.0 + r + g / 2.0, a / 2.0 + r,      b / 2.0 - (b - d) / 2.0 - size);
		p2.set(-l / 2.0 + r + g / 2.0, a / 2.0 + r + fo, b / 2.0 - (b - d) / 2.0 - size);
		FdPoint3d centralPointsF[2] = { p1, p2 };
		FdVector3d vectorF[2] = { vy, vy };
		FdVector3d upVectorF[2] = { vx, vx };
		double tabWidthF[2] = { (b - d) + 2 * size, (b - d) + 2 * size };
		double tabHeightF[2] = { g, g };
		bool sidesF[4] = { true, true, true, true };
		makeBox(1, centralPointsF, vectorF, upVectorF, tabWidthF, tabHeightF, sidesF, false, false, 5, (size > flange_3) ? 0 : 5, flange_3 - size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  d = copyd;  g = copyg;  r = copyr;  l = copyl;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		g -= 2 * size;  a -= 2 * size;  b -= 2 * size;  d -= 2 * size;
		r += size;

		// box
		FdPoint3d p1, p2, p3, p4;
		p1.set(-l / 2.0,         0, -b / 2.0 + d / 2.0);
		p2.set(-l / 2.0 + r + g, 0, -b / 2.0 + d / 2.0);
		p3.set( l / 2.0,         0, -b / 2.0 + d / 2.0);
		p4.set( l / 2.0 + fo,    0, -b / 2.0 + d / 2.0);
		FdPoint3d centralPoints[4] = { p1, p2, p3, p4 };
		FdVector3d vectors[4] = { vx, vx, vx, vx };
		FdVector3d upVectors[4] = { vy, vy, vy, vy };

		double tabWidth[4] = { d, d, d, d };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true, false, true, true,
		                   true, true,  true, true,
		                   true, true,  true, true };
		bool edges[7][4] = { true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     false, false, false, false,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true };
		makeBox(3, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, 5, 0, size);

		//--- the bend... drawn twice to fix gouraud shading issues
		p1.set(-l / 2.0, 0, b / 2.0 - (b - d) / 2.0 + size);
		bool sidesB[4] = { true, false, true, false };
		makeRectBend(p1, -vx, vz, sidesB, false, a, (b - d) - 2 * size, g, n, r, false);
		bool sidesB2[4] = { false, true, false, true };
		makeRectBend(p1, -vx, vz, sidesB2, false, a, (b - d) - 2 * size, g, n, r, false);

		// flange on left side
		p1.set(-l / 2.0,      0, 0);
		p2.set(-l / 2.0 - fo, 0, 0);
		FdPoint3d centralPointsC[2] = { p1, p2 };
		FdVector3d vectorC[2] = { vx, vx };
		FdVector3d upVectorC[2] = { vy, vy };
		double tabWidthC[2] = { b, b };
		double tabHeightC[2] = { a, a };
		bool sidesC[4] = { true, true, true, true };
		bool conC[2] = { false, true };
		makeBox(1, centralPointsC, vectorC, upVectorC, tabWidthC, tabHeightC, sidesC, false, false, 5, 0, size);

		// flange at the end of the bend
		p1.set(-l / 2.0 + r + g / 2.0, a / 2.0 + r,      b / 2.0 - (b - d) / 2.0 + size);
		p2.set(-l / 2.0 + r + g / 2.0, a / 2.0 + r + fo, b / 2.0 - (b - d) / 2.0 + size);
		FdPoint3d centralPointsF[2] = { p1, p2 };
		FdVector3d vectorF[2] = { vy, vy };
		FdVector3d upVectorF[2] = { vx, vx };
		double tabWidthF[2] = { (b - d) - 2 * size, (b - d) - 2 * size };
		double tabHeightF[2] = { g, g };
		bool sidesF[4] = { true, true, true, true };
		makeBox(1, centralPointsF, vectorF, upVectorF, tabWidthF, tabHeightF, sidesF, false, false, 5, 0, size);
	}
}

void GLERectangular :: makeTR9(double a, double b, double d, double g, double r, double l, double n, double flange_1, double flange_2, double flange_3)
{
	postTransformMesh( M_PI,     FdVector3d::kYAxis);
	postTransformMesh(-M_PI / 2, FdVector3d::kXAxis);
	l = l - 2 * fo;

	/**********************************GEOMETRY*************************************/
	FdPoint3d p1, p2, p3, p4;
	p1.set(-l / 2.0 - fo,    0, -b / 2.0 + d / 2.0);
	p2.set(-l / 2.0,         0, -b / 2.0 + d / 2.0);
	p3.set( l / 2.0 - r - g, 0, -b / 2.0 + d / 2.0);
	p4.set( l / 2.0,         0, -b / 2.0 + d / 2.0);
	FdPoint3d centralPoints[4] = { p1, p2, p3, p4 };
    FdVector3d vectors[4] = { vx, vx, vx, vx };
	double tabWidth[4] = { d, d, d, d };
	double tabHeight[4] = { a, a, a, a };
	bool sides[12] = { true, true,  true, true,
	                   true, true,  true, true,
	                   true, false, true, true };
	bool con[2] = { false, false };
	bool edges[7][4] = { true,  true,  true,  true,
	                     true,  true,  true,  true,
	                     true,  true,  true,  true,
	                     true,  true,  true,  true,
	                     false, false, false, false,
	                     true,  true,  true,  true,
	                     true,  true,  true,  true };
	makeBox(3, centralPoints, vectors, tabWidth, tabHeight, sides, edges, con, false, false);

	//--- the bend... drawn twice to fix shading issues
	p1.set( l / 2.0, 0, b / 2.0 - (b - d) / 2.0);
    bool sidesB[4] = { true, false, true, false };
	makeRectBend(p1, vx, vy, sidesB, false, (b - d), a, g, n, r, false);
	bool sidesB2[4] = { false, true, false, true };
	makeRectBend(p1, vx, vy, sidesB2, false, (b - d), a, g, n, r, false);

	// flange on right side
	p1.set( l / 2.0,      0, 0);
	p2.set( l / 2.0 + fo, 0, 0);
	FdPoint3d centralPointsC[2] = { p1, p2 };
	double tabWidthC[2] = { b, b };
	double tabHeightC[2] = { a, a };
	bool sidesC[4] = { true, true, true, true };
	bool conC[2] = { false, false };
	makeBox(1, centralPointsC, tabWidthC, tabHeightC, sidesC, conC, false, false);

	// flange at the end of the bend
	p1.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 + r);
	p2.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 + r + fo);
	FdPoint3d centralPointsF[2] = { p1, p2 };
	double tabWidthF[2] = { a, a };
	double tabHeightF[2] = { g, g };
	bool sidesF[4] = { true, true, true, true };
	bool conF[2] = { false, false };
	makeBox(1, centralPointsF, tabWidthF, tabHeightF, sidesF, conF, false, false);


	//---DEFINE LINE TYPES
	//---CENTER LINES:
	// center line for the main box
	p1.set(-l / 2.0 - fo, 0, -b / 2.0 + d / 2.0);
	p2.set( l / 2.0 + fo, 0, -b / 2.0 + d / 2.0);
	addCenterLine(p1, p2);

	// center lines for the bend box
	p1.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 - (b - d) / 2);
	p2.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 + r + fo);
	addCenterLine(p1, p2);

	p1.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 - (b - d) / 2);
	p2.set( l / 2.0 + fo,          0, b / 2.0 - (b - d) / 2);
	addCenterLine(p1, p2);

	//--- CONNECTOR LINES:
	// left connector
	p1.set(-l / 2.0 - fo, 0, -b / 2.0 + d / 2.0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_2, d + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, d, flange_2);

	// right connector
	p1.set( l / 2 + fo, 0, 0);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);

	// bend connector
	p1.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 + r + fo);
	addRectangularConnector(p1, vz, vy, a + 2 * flange_3, g + 2 * flange_3);
	makeRectangularFlange(p1, vz, vy, a, g, flange_3);

	//--- THIN LINES:
	p1.set(-l / 2.0, 0, -b / 2.0 + d / 2.0);
	addSymbolicFlangeRect(p1, vx, vy, a, d);

	p1.set( l / 2, 0, 0);
	addSymbolicFlangeRect(p1, vx, vy, a, b);

	p1.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 + r);
	addSymbolicFlangeRect(p1, vz, vy, a, g);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyd = d, copyg = g, copyr = r, copyl = l;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		if( size >= r )
			{  size = r - 0.1;  };

		a += 2 * size;  d += 2 * size;  b += 2 * size;  g += 2 * size;
		r -= size;

		p1.set(-l / 2.0 - fo,    0, -b / 2.0 + d / 2.0);
		p2.set(-l / 2.0,         0, -b / 2.0 + d / 2.0);
		p3.set( l / 2.0 - r - g, 0, -b / 2.0 + d / 2.0);
		p4.set( l / 2.0,         0, -b / 2.0 + d / 2.0);
		FdPoint3d centralPoints[4] = { p1, p2, p3, p4 };
		FdVector3d vectors[4] = { vx, vx, vx, vx };
		FdVector3d upVectors[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { d, d, d, d };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true, true,  true, true,
		                   true, true,  true, true,
		                   true, false, true, true };
		// bool con[2] = { true, false };
		bool edges[7][4] = { true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     false, false, false, false,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true };
		makeBox(3, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false, false, (size > flange_2) ? 0 : 5, 5, flange_2 - size);

		//--- the bend... drawn twice to fix shading issues
		p1.set( l / 2.0, 0, b / 2.0 - (b - d) / 2.0);
		bool sidesB[4] = { true, false, true, false };
		makeRectBend(p1, vx, vy, sidesB, false, (b - d), a, g, n, r, false);
		bool sidesB2[4] = { false, true, false, false };
		makeRectBend(p1, vx, vy, sidesB2, false, (b - d), a, g, n, r, false);

		// flange on right side
		p1.set( l / 2.0,      0, 0);
		p2.set( l / 2.0 + fo, 0, 0);
		FdPoint3d centralPointsC[2] = { p1, p2 };
		double tabWidthC[2] = { b, b };
		double tabHeightC[2] = { a, a };
		bool sidesC[4] = { true, true, true, true };
		makeBox(1, centralPointsC, vectors, upVectors, tabWidthC, tabHeightC, sidesC, false, false, 5, (size > flange_1) ? 0 : 5, flange_1 - size);

		// flange at the end of the bend
		p1.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 + r);
		p2.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 + r + fo);
		FdPoint3d centralPointsF[2] = { p1, p2 };
		FdVector3d vectorsF[4] = { vz, vz, vz, vz };
		FdVector3d upVectorsF[4] = { vx, vx, vx, vx };
		double tabWidthF[2] = { a, a };
		double tabHeightF[2] = { g, g };
		bool sidesF[4] = { true, true, true, true };
		bool conF[2] = { false, true };
		makeBox(1, centralPointsF, vectorsF, upVectorsF, tabWidthF, tabHeightF, sidesF, false, false, 5, (size > flange_3) ? 0 : 5, flange_3 - size);

		p1.set( l / 2.0 - g - r, -a / 2, -b / 2.0 + d);
		p2.set( l / 2.0 - g - r,  a / 2, -b / 2.0 + d);
		p3.set( l / 2.0 - g - r,  a / 2,  b / 2.0 + r);
		p4.set( l / 2.0 - g - r, -a / 2,  b / 2.0 + r);
		makePlane(p1, p2, p3, p4);
	}

	/****************************Retrive vairables*******************/
	a = copya;  b = copyb;  d = copyd;  g = copyg;  r = copyr;  l = copyl;

	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		a -= 2 * size;  d -= 2 * size;  b -= 2 * size;  g -= 2 * size;
		r += size;

		p1.set(-l / 2.0 - fo,    0, -b / 2.0 + d / 2.0);
		p2.set(-l / 2.0,         0, -b / 2.0 + d / 2.0);
		p3.set( l / 2.0 - r - g, 0, -b / 2.0 + d / 2.0);
		p4.set( l / 2.0,         0, -b / 2.0 + d / 2.0);
		FdPoint3d centralPoints[4] = { p1, p2, p3, p4 };
		FdVector3d vectors[4] = { vx, vx, vx, vx };
		FdVector3d upVectors[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { d, d, d, d };
		double tabHeight[4] = { a, a, a, a };
		bool sides[12] = { true, true,  true, true,
		                   true, true,  true, true,
		                   true, false, true, true };
		bool con[2] = { true, false };
		bool edges[7][4] = { true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true,
		                     false, false, false, false,
		                     true,  true,  true,  true,
		                     true,  true,  true,  true };
		makeBox(3, centralPoints, vectors, upVectors, tabWidth, tabHeight, sides, edges, false,false, 0, 5, size);

		//--- the bend... drawn twice to fix shading issues
		p1.set( l / 2.0, 0, b / 2.0 - (b - d) / 2.0 + size);
		bool sidesB[4] = { true, false, true, false };
		makeRectBend(p1, vx, vy, sidesB, false, (b - d) - 2 * size, a, g, n, r, false);
		bool sidesB2[4] = { false, true, false, true };
		makeRectBend(p1, vx, vy, sidesB2, false, (b - d) - 2 * size, a, g, n, r, false);

		// flange on right side
		p1.set( l / 2.0,      0, 0);
		p2.set( l / 2.0 + fo, 0, 0);
		FdPoint3d centralPointsC[2] = { p1, p2 };
		double tabWidthC[2] = { b, b };
		double tabHeightC[2] = { a, a };
		bool sidesC[4] = { true, true, true, true };
		bool conC[2] = { false, true };
		makeBox(1, centralPointsC, vectors, upVectors, tabWidthC, tabHeightC, sidesC, false, false, 5, 0, size);

		// flange at the end of the bend
		p1.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 + r);
		p2.set( l / 2.0 - r - g / 2.0, 0, b / 2.0 + r + fo);
		FdPoint3d centralPointsF[2] = { p1, p2 };
		double tabWidthF[2] = { a, a };
		double tabHeightF[2] = { g, g };
		bool sidesF[4] = { true, true, true, true };
		bool conF[2] = { false, true };
		FdVector3d vectorF[2] = { vz, vz };
		FdVector3d upVectorF[2] = { vx, vx };
		makeBox(1, centralPointsF, vectorF, upVectorF, tabWidthF, tabHeightF, sidesF, false, false, 5, 0, size);
	}
}

void GLERectangular :: makeUA(double a, double b, double c, double d, double l, double e, double f, double flange_1, double flange_2)
{
	postTransformMesh(M_PI / 2, FdVector3d::kXAxis);

	l = l - 2 * fo;

	/**********************************GEOMETRY*************************************/
	FdPoint3d p1, p2, p3, p4;
	p1.set(-l / 2.0 - fo, 0,                      0);
	p2.set(-l / 2.0,      0,                      0);
	p3.set( l / 2.0,      a / 2.0 + f - c / 2.0, -b / 2.0 - e + d / 2.0);
	p4.set( l / 2.0 + fo, a / 2.0 + f - c / 2.0, -b / 2.0 - e + d / 2.0);

	FdPoint3d cp[4] = { p1, p2, p3, p4 };
	FdVector3d v[4] = { vx, vx, vx, vx };
	FdVector3d upv[4] = { vy, vy, vy, vy };
	double tabWidth[4] = { b, b, d, d };
	double tabHeight[4] = { a, a, c, c };
	bool sides[12] = { true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true };
	bool edges1[7][4] = { true,  true,  true,  true,
	                      true,  true,  true,  true,
	                      false, false, false, false,
	                      true,  true,  true,  true,
	                      false, false, false, false, 
	                      true,  true,  true,  true,
	                      true,  true,  true,  true };

	bool con[2] = { false, false };
	int flange = (flange_1 == flange_2) ? 0 : 5;
	makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, flange, flange, flange_1);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyc = c, copyd = d, copyl = l, copye = e, copyf = f;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		a += 2 * size;  b += 2 * size;  c += 2 * size;  d += 2 * size;
		// e += size;  f += size;

		FdPoint3d p1, p2, p3, p4;
		p1.set(-l / 2.0 - fo, 0,                      0);
		p2.set(-l / 2.0,      0,                      0);
		p3.set( l / 2.0,      a / 2.0 + f - c / 2.0, -b / 2.0 - e + d / 2.0);
		p4.set( l / 2.0 + fo, a / 2.0 + f - c / 2.0, -b / 2.0 - e + d / 2.0);

		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { b, b, d, d };
		double tabHeight[4] = { a, a, c, c };
		bool sides[12] = { true, true, true, true,
		                   true, true, true, true,
		                   true, true, true, true };

		int flange_size = flange_1 - size;
		int flange1 = (size > flange_1) ? 0 : 5;
		int flange2 = (size > flange_2) ? 0 : 5;
		if( flange_1 != flange_2 )
		{
			if( size > flange_1 && size > flange_2 )
				flange1 = flange2 = 5;
			else if( size > flange_2 )
				flange_size = flange_2 - size;
		}
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, flange1, flange2, flange_size);

		if( flange_1 != flange_2 && size > flange_1 && size > flange_2 )
		{
			makeRectangularFlange(p1, vx, vy, a - 2 * size + 2 * flange_1, b - 2 * size + 2 * flange_1, size - flange_1);
			makeRectangularFlange(p4, vx, vy, c - 2 * size + 2 * flange_2, d - 2 * size + 2 * flange_2, size - flange_2);
		}
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  c = copyc;  d = copyd;  l = copyl;  e = copye;  f = copyf;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		a -= 2 * size;  b -= 2 * size;  c -= 2 * size;  d -= 2 * size;

		FdPoint3d p1, p2, p3, p4;
		p1.set(-l / 2.0 - fo, 0,                      0);
		p2.set(-l / 2.0,      0,                      0);
		p3.set( l / 2.0,      a / 2.0 + f - c / 2.0, -b / 2.0 - e + d / 2.0);
		p4.set( l / 2.0 + fo, a / 2.0 + f - c / 2.0, -b / 2.0 - e + d / 2.0);

		FdPoint3d cp[4] = { p1, p2, p3, p4 };
		FdVector3d v[4] = { vx, vx, vx, vx };
		FdVector3d upv[4] = { vy, vy, vy, vy };
		double tabWidth[4] = { b, b, d, d };
		double tabHeight[4] = { a, a, c, c };
		bool sides[12] = { true, true, true, true,
		                   true, true, true, true,
		                   true, true, true, true };
		makeBox(3, cp, v, upv, tabWidth, tabHeight, sides, edges1, false, false, 0, 0, size);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  c = copyc;  d = copyd;  l = copyl;  e = copye;  f = copyf;
	setPrimitiveMode(FLM3Geo::pmNormal);

	l += fo * 2;
	//--- Specify two rectangular connectors.
	p1.set(-l / 2, cp[0].y, cp[0].z);
	p2.set( l / 2, cp[3].y, cp[3].z);
	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, c + 2 * flange_2, d + 2 * flange_2);

	if( flange_1 != flange_2 )
	{
		makeRectangularFlange(p1, vx, vy, a, b, flange_1);
		makeRectangularFlange(p2, vx, vy, c, d, flange_2);
	}

	//--- Add the center line.
	addCenterPolyLine(cp, 3);

	//--- Add thin lines for the beginning of the flange.
	p1.set(-l / 2 + fo, cp[0].y, cp[0].z);
	addSymbolicFlangeRect(p1, vx, vy, a, b);
	drawRectAsThinLines(p1, vx, vy, a, b);

	p1.set( l / 2 - fo, cp[3].y, cp[3].z);
	addSymbolicFlangeRect(p1, vx, vy, c, d);
	drawRectAsThinLines(p1, vx, vy, c, d);
}

void GLERectangular :: makeWA(double alfa, double a, double b, double d, double e, double f, double r, double n, double flange_1, double flange_2)
{
	/****************************Copy/create Insulation vairables*******************/
	double copyalfa = alfa, copya = a, copyb = b, copyd = d, copye = e, copyf = f, copyr = r;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		e -= size;  f -= size;
		d += 2 * size;  b += 2 * size;  a += 2 * size;

		//--- Some initial reference calculations to make things easier.  Variables
		//--- 'x' & 'y' are the coordinates of B connector's center on the XY plane.
		double rang = M_PI * alfa / 180.0,
		          x = -((copyb + copyr - copyr * cos(rang) + fo * sin(rang)) / 2.0) + copyb / 2,
		          y = -(((copyd + copyr) * sin(rang) + fo * (cos(rang) - 1)) / 2.0 + copyf) + copyf;

		//--- Define some initial commonly used vectors associated with dimensions.
		FdVector3d bVec = vx * b / 2, aVec = vz * a / 2;

		//--- Make the bend.
		FdPoint3d bStart(x, y, 0);
		bool sides[8] = { true, true, true, true, true, true, true, true };
		makeSymetricBend(bStart, -vy, -vz, sides, false, alfa, b, a, d, 0, n, r - size, r + size, e, true);

		//--- Make the B connector.
		FdPoint3d bBase = bStart - vy * (copyf - BSFlange), bConn = bBase - vy * BSFlange, bCenters[3] = { bStart, bBase, bConn };
		FdVector3d bNormals[3] = { vy, vy, vy }, ups[3] = { vz, vz, vz };
		double bWidths[3]  = { b, b, b }, heights[3] = { a, a, a };
		makeBox(2, bCenters, bNormals, ups, bWidths, heights, sides, false, false, 5, (size > flange_1) ? 0 : 5, flange_1 - size);

		//--- Make the D connector.
		//-- First find the 3 points and normal of the D connector.
		FdPoint3d axisOfRot = bStart + vx * (copyb / 2 + r);  // Were the bend a donut section, this would be the center.
		FdVector3d dVec = -vx;  dVec.rotateBy(rang, -vz);  // The direction in which length "d" applies.
		FdVector3d dNormal = dVec.crossProduct(vz);
		FdPoint3d dStart = axisOfRot + dVec * (copyr + copyd / 2), dBase = dStart + dNormal * (copye - BSFlange), dConn = dBase + dNormal * BSFlange;

		//-- Now call the connector function.
		FdPoint3d dcenters[3] = { dStart, dBase, dConn };
		FdVector3d dNormals[3] = { dNormal, dNormal, dNormal };
		double dWidths[3] = { d, d, d };
		makeBox(2, dcenters, dNormals, ups, dWidths, heights, sides, false, false, 5, (size > flange_2) ? 0 : 5, flange_2 - size);
	}

	/**********************************Recover variables*******************************/
	alfa = copyalfa;  a = copya;  b = copyb;  d = copyd;  e = copye;  f = copyf;  r = copyr;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		e += size;  f += size;
		d -= 2 * size;  b -= 2 * size;  a -= 2 * size;

		//--- Some initial reference calculations to make things easier.  Variables
		//--- 'x' & 'y' are the coordinates of B connector's center on the XY plane.
		double rang = M_PI * alfa / 180.0,
		          x = -((copyb + copyr - copyr * cos(rang) + fo * sin(rang)) / 2.0) + copyb / 2,
		          y = -(((copyd + r) * sin(rang) + fo * (cos(rang) - 1)) / 2.0 + copyf) + copyf;

		//--- Define some initial commonly used vectors associated with dimensions.
		FdVector3d bVec = vx * b / 2, aVec = vz * a / 2;

		//--- Make the bend.
		FdPoint3d bStart(x, y, 0);
		bool sides[8] = { true, true, true, true, true, true, true, true };
		makeSymetricBend(bStart, -vy, -vz, sides, false, alfa, b, a, d, 0, n, r + size, r - size, e, true);

		//--- Make the B connector.
		FdPoint3d bBase = bStart - vy * (copyf - BSFlange), bConn = bBase - vy * BSFlange, bCenters[3] = { bStart, bBase, bConn };
		FdVector3d bNormals[3] = { vy, vy, vy }, ups[3] = { vz, vz, vz };
		double bWidths[3] = { b, b, b }, heights[3] = { a, a, a };
		makeBox(2, bCenters, bNormals, ups, bWidths, heights, sides, false, false, 5, 0, size);

		//--- Make the D connector.
		//-- First find the 3 points and normal of the D connector.
		FdPoint3d axisOfRot = bStart + vx * (copyb / 2 + r);  // Were the bend a donut section, this would be the center.
		FdVector3d dVec = -vx;  dVec.rotateBy(rang, -vz);  // The direction in which length "d" applies.
		FdVector3d dNormal = dVec.crossProduct(vz);
		FdPoint3d dStart = axisOfRot + dVec * (copyr + copyd / 2), dBase = dStart + dNormal * (copye - BSFlange), dConn = dBase + dNormal * BSFlange;

		//-- Now call the connector function.
		FdPoint3d dcenters[3] = { dStart, dBase, dConn };
		FdVector3d dNormals[3] = { dNormal, dNormal, dNormal };
		double dWidths[3] = { d, d, d };
		makeBox(2, dcenters, dNormals, ups, dWidths, heights, sides, false, false, 5, 0, size);
	}

	/**********************************Recover variables*******************************/
	alfa = copyalfa;  a = copya;  b = copyb;  d = copyd;  e = copye;  f = copyf;  r = copyr;

	/**********************************GEOMETRY*************************************/
	setPrimitiveMode(FLM3Geo::pmNormal);

	//--- Some initial reference calculations to make things easier.  Variables
	//--- 'x' & 'y' are the coordinates of B connector's center on the XY plane.
	double rang = M_PI * alfa / 180.0,
	          x = -((b + r - r * cos(rang) + fo * sin(rang)) / 2.0) + b / 2,
	          y = -(((d + r) * sin(rang) + fo * (cos(rang) - 1)) / 2.0 + f) + f;

	//--- Define some initial commonly used vectors associated with dimensions.
	FdVector3d bVec = vx * b / 2, aVec = vz * a / 2;

	//--- Make the bend.
	FdPoint3d bStart(x, y, 0);
	bool sides[8] = { true, true, true, true, true, true, true, true };
	makeSymetricBend(bStart, -vy, -vz, sides, false, alfa, b, a, d, 0, n, r, e, false);

	//--- Make the B connector.
	FdPoint3d bBase = bStart - vy * (f - BSFlange), bConn = bBase - vy * BSFlange, bCenters[3] = {bStart, bBase, bConn};
	FdVector3d bNormals[3] = { vy, vy, vy }, ups[3] = { vz, vz, vz };
	double bWidths[3]  = { b, b, b }, heights[3] = { a, a, a };
	makeBox(2, bCenters, bNormals, ups, bWidths, heights, sides, false, false, 5, 0, flange_1);

	//--- Make the D connector.
	//-- First find the 3 points and normal of the D connector.
	FdPoint3d axisOfRot = bStart + vx * (b / 2 + r);  // Were the bend a donut section, this would be the center.
	FdVector3d dVec = -vx;  dVec.rotateBy(rang, -vz);  // The direction in which length "d" applies.
	FdVector3d dNormal = dVec.crossProduct(vz);
	FdPoint3d dStart = axisOfRot + dVec * (r + d / 2), dBase = dStart + dNormal * (e - BSFlange), dConn = dBase + dNormal * BSFlange;

	//-- Now call the connector function.
	FdPoint3d dcenters[3] = { dStart, dBase, dConn };
	FdVector3d dNormals[3] = { dNormal, dNormal, dNormal };
	double dWidths[3] = { d, d, d };
	makeBox(2, dcenters, dNormals, ups, dWidths, heights, sides, false, false, 5, 0, flange_2);

	//--- Add line definitions for the B connector.
	addRectangularConnector(bConn, vy, vz, a + 2 * flange_1, b + 2 * flange_1);
	addSymbolicFlangeRect(bBase, vy, vz, a, b);
	drawRectAsThinLines(bBase, vy, vz, a, b);

	//--- Add line definitions for the D connector.
	addRectangularConnector(dConn, dNormal, vz, a + 2 * flange_2, d + 2 * flange_2);
	addSymbolicFlangeRect(dBase, dNormal, vz, a, d);
	drawRectAsThinLines(dBase, dNormal, vz, a, d);

	//--- Erase the lines where the bend meets the B connector.
	bool eraseSides[4] = { true, false, true, true };
	addEraseRect(bStart, vy, vz, a, b, eraseSides);
	addEraseLine(bStart + bVec + aVec, bStart + bVec - aVec, vx);

	//--- Erase the lines where the bend meets the D connector.
	addEraseRect(dStart, dNormal, vz, a, d, eraseSides);
	addEraseLine(dStart -dVec * (d / 2) + aVec, dStart - dVec * (d / 2) - aVec, dVec);

	//--- Erase the 2 lines that occur on the bend itself, where the outer arc meets the straight planes.
	FdPoint3d line1Beg = bStart - bVec, line1End = line1Beg + vy * b * d,
	          line2Beg = dStart + dVec * d / 2, line2End = line2Beg - dNormal * b * d;
	FdPoint3d innerPeak, outerPeak;
	lineSegToLineSegInt(line1Beg, line1End, line2Beg, line2End, outerPeak);
	line1Beg = bStart + bVec;  line1End = line1Beg + vy * b * d;
	line2Beg = dStart - dVec * d / 2;  line2End = line2Beg - dNormal * b * d;
	lineSegToLineSegInt(line1Beg, line1End, line2Beg, line2End, innerPeak);
	FdVector3d bendVec = outerPeak - innerPeak;
	addEraseLine(line1Beg + aVec + bendVec, line1Beg - aVec + bendVec, vx);
	addEraseLine(line2Beg + aVec + bendVec, line2Beg - aVec + bendVec, dVec);

	//--- Add center lines for the bend.
	addCenterLine(bConn, line1Beg + bendVec / 2);
	addCenterLine(dConn, line2Beg + bendVec / 2);
	addCenterArc(axisOfRot + bendVec / 2, -vz, -vx, r, 0, rang);
}

void GLERectangular :: makeWS(double alfa, double a, double b, double e, double f, double r, double n, double flange_1, double flange_2)
{
	makeWA(alfa, a, b, b, e, f, r, n, flange_1, flange_2);
}
////////////////////////////////////////END OF GENERAL RECTANGULAR ELEMENT FUNCTIONS///////////////////////////////////////

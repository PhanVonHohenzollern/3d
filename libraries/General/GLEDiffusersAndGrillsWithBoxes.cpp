#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

#define GLEDiffusersAndGrillsWithBoxes SmkGenBlockCreator

#define tubel 50 // length of a tube just after the grill

/////////////////////////////BEGINNING OF GENERAL DIFFUSERS AND GRILLS WITH BOXES FUNCTIONS///////////////////////////////////
//for all the grill with box functions:
//diam1 is the diameter of the tube connected to the box
//diam2 is the diameter of the circular grill connector (if applicable)
//boxDepth is obvious
//length1 is the length of the tube connected to the box
//height and width are obvious

void GLEDiffusersAndGrillsWithBoxes::makeBCD1(double diam1, double diam2, double boxDepth, double length1, double height, double width, int n)
{
	postTransformMesh(M_PI, FdVector3d::kXAxis);

	//make box
	FdPoint3d p1(0, 0, -boxDepth), p2(0,0,0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = {height,height}; //remember how perpVector works
	double tabHeight[2] = {width,width};
	bool sides[4] = {true, false, true, true};
	bool con[2] = {false,false};
	makeBox(1,centralPoints, tabWidth,tabHeight,sides,con,true,false);
	
	//make plane with circular hole (for the grill connector)
	double heightWidth[2] = {width, height};
	double tubeParams[3] = { diam2, diam2, 0 };
	makeRectToTubeTransition(p2, vz, vx, heightWidth, p2, tubeParams, n);
	drawAsThinArc(p1);

	//make plane with circular hole (for the tube)
	p1.set(0, height/2.0, -boxDepth/2.0);
	double heightWidth2[2] = { width, boxDepth };
	p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
	double tubeParams2[3] = {diam1, diam1, 0};
	makeRectToTubeTransition(p1, vy, vx, heightWidth2, p2, tubeParams2, n);

	//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
	p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
	p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40);
	FdPoint3d centers[2] = { p1, p2 };
	makeVerySimpleTube(centers, diam1, n);
	drawAsThinArc(p2);
	p1.set(0, height/2.0 + length1, 0);
	addCircularConnector(p1);
	
	double m = 5;
	double h = 25;
	double flangeSize = 52; // the default value for this grill in the general library
	
	//grill type3
	p1.set(0, 0, tubel);
	makeGrillType3(p1, vz, diam2/4.0, diam2, diam2 + 50, n, 5, 25, h);

	//tube just after the connector
	p1.set(0, 0, 0); p2.set(0, 0, tubel);
	centers[0] = p1; centers[1] = p2;
	makeVerySimpleTube(centers, diam2, n);
	
	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copydiam2 = diam2, copyboxDepth = boxDepth, copylength1 = length1, copyheight = height, copywidth = width;
	
	/**********************************Ext Insulation*******************************/
	double size;
	if ( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		
		diam1 += 2 * size; diam2 += 2 * size;
		boxDepth += 2 * size; height += 2 * size;
		width += 2 * size;
		length1 -= size;

		//make box
		FdPoint3d p1(0, 0, -boxDepth + size), p2(0,0,size);
		FdPoint3d centralPoints[2] = { p1, p2 };
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		bool con[2] = {false,false};
		makeBox(1,centralPoints, tabWidth,tabHeight,sides,con,true,false);
		
		//make plane with circular hole (for the grill connector)
		double heightWidth[2] = {width, height};
		double tubeParams[3] = { diam2, diam2, 0 };
		makeRectToTubeTransition(p2, vz, vx, heightWidth, p2, tubeParams, n);

		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, -boxDepth/2.0 + size);
		double heightWidth2[2] = { width, boxDepth };
		p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40 + size);
		double tubeParams2[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth2, p2, tubeParams2, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40 + size);
		p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40 + size);
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);

		makeFlatRing(p2, vy, diam1, diam1 - 2*size, n);
		
		//tube just after the connector
		p1.set(0, 0, size); p2.set(0, 0, tubel);
		centers[0] = p1; centers[1] = p2;
		makeVerySimpleTube(centers, diam2, n);				
	}
	/**********************************Recover variables*******************************/
	diam1 = copydiam1; diam2 = copydiam2; boxDepth = copyboxDepth; length1 = copylength1; height = copyheight; width = copywidth;
	
	/**********************************Int Insulation*******************************/
	if (getIntInsSize(size))
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		diam1 -= 2 * size; diam2 -= 2 * size;
		boxDepth -= 2 * size; height -= 2 * size;
		width -= 2 * size;
		length1 += size;

		//make box
		FdPoint3d p1(0, 0, - boxDepth - size), p2(0, 0, -size);
		FdPoint3d centralPoints[2] = { p1, p2 };
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		bool con[2] = {false,false};
		makeBox(1,centralPoints, tabWidth,tabHeight,sides,con,true,false);
		
		//make plane with circular hole (for the grill connector)
		double heightWidth[2] = {width, height};
		double tubeParams[3] = { diam2, diam2, 0 };
		makeRectToTubeTransition(p2, vz, vx, heightWidth, p2, tubeParams, n);

		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, -boxDepth/2.0 - size);
		double heightWidth2[2] = { width, boxDepth };
		p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40 - size);
		double tubeParams2[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth2, p2, tubeParams2, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40 - size);
		p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40 - size);
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);

		makeFlatRing(p2, vy, diam1, diam1 + 2*size, n);
		
		//tube just after the connector
		p1.set(0, 0, -size); p2.set(0, 0, tubel);
		centers[0] = p1; centers[1] = p2;
		makeVerySimpleTube(centers, diam2, n);
	}
}

void GLEDiffusersAndGrillsWithBoxes::makeBLD1(double diam1, double boxDepth, double length1, double height, double width, int n, int m, double a)
{
	postTransformMesh(M_PI, FdVector3d::kXAxis);

	//make box
	FdPoint3d p1( 0, 0, -boxDepth/2.0),p2(0, 0, boxDepth/2.0);
	FdPoint3d centralPoints[2] = {p1, p2};
	double tabWidth[2] = {height,height}; //remember how perpVector works
	double tabHeight[2] = {width,width};
	bool sides[4] = {true, false, true, true};
	bool con[2] = {false,false};
	makeBox(1, centralPoints, tabWidth, tabHeight, sides, con, true, false);
	
	//make plane with circular hole (for the tube)
	p1.set(0, height/2.0, 0);	
	double heightWidth[2] = {width, boxDepth};
	double tubeParams[3] = {diam1, diam1, 0};
	makeRectToTubeTransition(p1, vy, vx, heightWidth, p1, tubeParams, n);

	//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
	p1.set(0, height/2.0, 0); p2.set(0, height/2.0 + length1, 0); 
	FdPoint3d centers[2] = { p1, p2 };
	makeVerySimpleTube(centers, diam1, n);
	addCircularConnector(p2);

	p1.set(0, 0, boxDepth/2.0);
	makeGrillType6(p1, vz, vy, width, height, m, a);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copyboxDepth = boxDepth, copylength1 = length1, copyheight = height, copywidth = width; 

	/**********************************Ext Insulation*******************************/
	double size;
	if ( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
	
		diam1 += 2*size; boxDepth += size; width += 2*size; height += 2 * size;
		length1 -= size;

		FdPoint3d p1( 0, 0, -boxDepth/2.0-size/2),p2(0, 0, boxDepth/2.0-size/2);
		FdPoint3d centralPoints[2] = {p1, p2};
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		bool con[2] = {false,false};
		makeBox(1, centralPoints, tabWidth, tabHeight, sides, con, true, false);
		
		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, -size/2);	
		p2.set(0, height/2.0, 0);
		double heightWidth[2] = {width, boxDepth};
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, 0); p2.set(0, height/2.0 + length1, 0); 
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);
		
		makeFlatRing(p2,vy ,diam1, diam1-2*size, n);
	}
	/**********************************Recover variables*******************************/
	diam1 = copydiam1, boxDepth = copyboxDepth, length1 = copylength1, height = copyheight, width = copywidth; 

	/**********************************Int Insulation*******************************/
	if (getIntInsSize(size))
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		diam1 -= 2*size; boxDepth -= size; width -= 2*size; height -= 2 * size;
		length1 += size;

		FdPoint3d p1( 0, 0, -boxDepth/2.0+size/2),p2(0, 0, boxDepth/2.0+size/2);
		FdPoint3d centralPoints[2] = {p1, p2};
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		bool con[2] = {false,false};
		makeBox(1, centralPoints, tabWidth, tabHeight, sides, con, true, false);
		
		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, size/2);	
		p2.set(0, height/2.0, 0);
		double heightWidth[2] = {width, boxDepth};
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, 0); p2.set(0, height/2.0 + length1, 0); 
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);
		
		makeFlatRing(p2,vy ,diam1, diam1+2*size, n);		
	}
}

void GLEDiffusersAndGrillsWithBoxes::makeBRD1(double diam1, double boxDepth, double length1, double height, double width, int n)
{
	postTransformMesh(M_PI, FdVector3d::kXAxis);
	
	//make box
	FdPoint3d p1,p2;
	p1.set(0, 0, -boxDepth); p2.set(0, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = {height,height}; //remember how perpVector works
	double tabHeight[2] = {width,width};
	bool sides[4] = {true, false, true, true};
	bool con[2] = {false,false};
	makeBox(1,centralPoints, tabWidth,tabHeight,sides,con,true,false);
	
	//make plane with circular hole (for the tube)
	p1.set(0, height/2.0, -boxDepth/2.0);
	double heightWidth[2] = {width, boxDepth};
	p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
	double tubeParams[3] = {diam1, diam1, 0};
	makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);

	//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
	p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
	p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40); 
	FdPoint3d centers[2] = { p1, p2 };
	makeVerySimpleTube(centers, diam1, n);

	double frame = 15, thickness = 20,  alfa = 45;
	double H = height, L = width;
	
	double r=5, ln=3, Pl = 22.5, ft = 7;
	double x = thickness * tan(alfa * M_PI / 180);
	
	//get vairables from .pnr file
	L -= 2 * x;		
	H -= 2 * x;

	double A = L + 2 * x;	
	double B = H + 2 * x;
	
	double C = L + 2 * x + 2 * frame;
	double E = H + 2 * x + 2 * frame;
	
	//calculate variables
	ln = floor( min(A, B) / (2*Pl) );
	ln = ln-1;
	
	//grill
	FdPoint3d cp(0, 0, ft);
	makeRectGrillType1(cp, -vz, vy, A, B, thickness, alfa, r, ln, 1);

	p1.set(0, 0, ft); p2.set(0, 0, 0);
	FdPoint3d p[4] = { p1,p1,p2,p2 };
	FdVector3d v[4] =   {-vz, -vz, -vz, -vz};
	FdVector3d upv[4] = {vy, vy, vy, vy};
	double tabWidthb[4]  = {A,C,C,A};
	double tabHeightb[4] = {B,E,E,B};
	bool sidesb[12] = {true, true, true, true, true, true, true, true, true, true, true, true};
	makeBox(3, p, v, upv,tabWidthb, tabHeightb, sidesb, false, false, 5,5,0);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copyboxDepth = boxDepth, copylength1 = length1, copyheight = height, copywidth = width;

	/**********************************Ext Insulation*******************************/
	double size;
	if ( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		
		diam1 += 2 * size; boxDepth += size; height += 2 * size; width += 2 * size;
		length1 -= size;
		
		//make box
		FdPoint3d p1,p2;
		p1.set(0, 0, -boxDepth); p2.set(0, 0, 0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = {vz,vz};
		FdVector3d upv[2] = {vx,vx};
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		makeBox(1,centralPoints, v, upv, tabWidth,tabHeight,sides,true,false, 5, (size > frame)?0:5, frame - size);
		
		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, -boxDepth/2.0);
		double heightWidth[2] = {width, boxDepth};
		p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
		p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40); 
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);

		makeFlatRing(p2, vy, diam1, diam1-2*size,n);
	}

	/**********************************Recover variables*******************************/
	diam1 = copydiam1; boxDepth = copyboxDepth; length1 = copylength1; height = copyheight; width = copywidth;

	/**********************************Int Insulation*******************************/
	if (getIntInsSize(size))
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
	
		diam1 -= 2 * size; boxDepth -= size; height -= 2 * size; width -= 2 * size;
		length1 += size;
		
		//make box
		FdPoint3d p1,p2;
		p1.set(0, 0, -boxDepth); p2.set(0, 0, 0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = {vz,vz};
		FdVector3d upv[2] = {vx,vx};
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		makeBox(1,centralPoints, v, upv, tabWidth,tabHeight,sides,true,false, 5, 5, size);
		
		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, -boxDepth/2.0);
		double heightWidth[2] = {width, boxDepth};
		p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
		p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40); 
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);

		makeFlatRing(p2, vy, diam1, diam1+2*size,n);
	
	}
}

void GLEDiffusersAndGrillsWithBoxes::makeBRG1(double diam1, double boxDepth, double length1, double height, double width, int n)
{
	postTransformMesh(M_PI, FdVector3d::kXAxis);
	
	//make box
	FdPoint3d p1(0, 0, -boxDepth/2.0), p2(0, 0, boxDepth/2.0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = {height,height}; //remember how perpVector works
	double tabHeight[2] = {width,width};
	bool sides[4] = {true, false, true, true};
	bool con[2] = {false,false};
	makeBox(1,centralPoints, tabWidth,tabHeight,sides,con,true,false);
	
	//make plane with circular hole (for the tube)
	p1.set(0, height/2.0, 0); 
	double heightWidth[2] = {width, boxDepth};
	p2.set( 0, height/2.0, -boxDepth/2.0 + diam1/2.0 + 40 );
	double tubeParams[3] = {diam1, diam1, 0};
	makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);
	
	//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
	p1.set(0, height/2.0, -boxDepth/2.0 + diam1/2.0 + 40); p2.set(0, height/2.0 + length1, -boxDepth/2.0 + diam1/2.0 + 40);
	FdPoint3d centers[2] = { p1, p2 };
	makeVerySimpleTube(centers, diam1, n);
	
	double frame = 15, thickness = 20,  alfa = 45;
	double H = height, L = width;
	
	double r=5, ln=3, Pl = 22.5, ft = 7;
	double x = thickness * tan(alfa * M_PI / 180);
		
	L -= 2 * x;		
	H -= 2 * x;
	
	//get vairables from .pnr file
	double A = L + 2 * x;
	double B = H + 2 * x;
	
	double C = L + 2 * x + 2 * frame;
	double E = H + 2 * x + 2 * frame;
	
	//calculate variables
	
	alfa  = atan(thickness / Pl);
	alfa = alfa * 180 / ARX_PI;
	ln = floor( min(A, B) / Pl );
	ln = ln-1;  
	
	//grill
	FdPoint3d cp(0, 0, boxDepth/2.0 + ft);
	makeRectGrillType4(cp, -vz, vy, A, B, thickness, alfa, r, ln, 1);

	p1.set(0, 0, boxDepth/2.0 + ft); p2.set(0, 0, boxDepth/2.0);
	FdPoint3d p[4] = { p1,p1,p2,p2 };
	FdVector3d v[4] =   {-vz, -vz, -vz, -vz};
	FdVector3d upv[4] = {vy, vy, vy, vy};
	double tabWidthb[4]  = {A,C,C,A};
	double tabHeightb[4] = {B,E,E,B};
	bool sidesb[12] = {true, true, true, true, true, true, true, true, true, true, true, true};
	makeBox(3, p, v, upv,tabWidthb, tabHeightb, sidesb, false, false, 5,5,0);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copyboxDepth = boxDepth, copylength1 = length1, copyheight = height, copywidth = width;
	
	/**********************************Ext Insulation*******************************/
	double size;
	if ( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		
		diam1 += 2 * size; boxDepth += size; height += 2*size; width += 2*size;
		length1 -= size; 

		//make box
		FdPoint3d p1(0, 0, -boxDepth/2.0 - size/2), p2(0, 0, boxDepth/2.0 - size/2);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = {vz,vz};
		FdVector3d upv[2] = {vx, vx};
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		makeBox(1,centralPoints,v,upv, tabWidth,tabHeight,sides,true,false, 5, (size > frame)?0:5, frame - size);
		
		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, 0- size/2); 
		double heightWidth[2] = {width, boxDepth};
		p2.set( 0, height/2.0, -boxDepth/2.0 + diam1/2.0 + 40 - size/2);
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, -boxDepth/2.0 + diam1/2.0 + 40 - size/2); p2.set(0, height/2.0 + length1, -boxDepth/2.0 + diam1/2.0 + 40- size/2);
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);				

		makeFlatRing(p2, vy, diam1, diam1 - 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	diam1 = copydiam1, boxDepth = copyboxDepth, length1 = copylength1, height = copyheight, width = copywidth;

	/**********************************Int Insulation*******************************/
	if (getIntInsSize(size))
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
	
		diam1 -= 2 * size; boxDepth -= size; height -= 2*size; width -= 2*size;
		length1 += size; 

		//make box
		FdPoint3d p1(0, 0, -boxDepth/2.0 + size/2), p2(0, 0, boxDepth/2.0 + size/2);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = {vz,vz};
		FdVector3d upv[2] = {vx, vx};
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		makeBox(1,centralPoints,v,upv, tabWidth,tabHeight,sides,true,false, 5, 5, frame - size);
		
		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, size/2); 
		double heightWidth[2] = {width, boxDepth};
		p2.set( 0, height/2.0, -boxDepth/2.0 + diam1/2.0 + 40 + size/2);
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, -boxDepth/2.0 + diam1/2.0 + 40 + size/2); p2.set(0, height/2.0 + length1, -boxDepth/2.0 + diam1/2.0 + 40 + size/2);
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);				

		makeFlatRing(p2, vy, diam1, diam1 + 2 * size, n);
	}
}

void GLEDiffusersAndGrillsWithBoxes::makeBSCD1(double diam1, double diam2, double boxDepth, double length1, double height, double width, int n)
{
	postTransformMesh(M_PI, FdVector3d::kXAxis);

	//make box
	FdPoint3d p1(0, 0, -boxDepth), p2(0,0,0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = {height,height}; //remember how perpVector works
	double tabHeight[2] = {width,width};
	bool sides[4] = {true, false, true, true};
	bool con[2] = {false,false};
	makeBox(1,centralPoints, tabWidth,tabHeight,sides,con,true,false);
	
	//make plane with circular hole (for the grill connector)
	double heightWidth[2] = {width, height};
	double tubeParams[3] = { diam2, diam2, 0 };
	makeRectToTubeTransition(p2, vz, vx, heightWidth, p2, tubeParams, n);
	drawAsThinArc(p1);

	//make plane with circular hole (for the tube)
	p1.set(0, height/2.0, -boxDepth/2.0);
	double heightWidth2[2] = { width, boxDepth };
	p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
	double tubeParams2[3] = {diam1, diam1, 0};
	makeRectToTubeTransition(p1, vy, vx, heightWidth2, p2, tubeParams2, n);

	//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
	p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
	p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40);
	FdPoint3d centers[2] = { p1, p2 };
	makeVerySimpleTube(centers, diam1, n);
	drawAsThinArc(p2);
	p1.set(0, height/2.0 + length1, 0);
	addCircularConnector(p1);
	
	// grill 
	double alfa = 30;
	double thickness = 10;
	double m = 4;
	p1.set(0, 0, tubel);
	makeGrillType4(p1, vz, vx, (diam2 - 40) / 2.0, diam2, diam2 + 40, alfa, thickness, n, m, false);

	//tube just after the connector
	p1.set(0, 0, 0); p2.set(0, 0, tubel);
	centers[0] = p1; centers[1] = p2;
	makeVerySimpleTube(centers, diam2, n);
	
	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copydiam2 = diam2, copyboxDepth = boxDepth, copylength1 = length1, copyheight = height, copywidth = width;
	
	/**********************************Ext Insulation*******************************/
	double size;
	if ( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		
		diam1 += 2 * size; diam2 += 2 * size;
		boxDepth += 2 * size; height += 2 * size;
		width += 2 * size;
		length1 -= size;

		//make box
		FdPoint3d p1(0, 0, -boxDepth + size), p2(0,0,size);
		FdPoint3d centralPoints[2] = { p1, p2 };
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		bool con[2] = {false,false};
		makeBox(1,centralPoints, tabWidth,tabHeight,sides,con,true,false);
		
		//make plane with circular hole (for the grill connector)
		double heightWidth[2] = {width, height};
		double tubeParams[3] = { diam2, diam2, 0 };
		makeRectToTubeTransition(p2, vz, vx, heightWidth, p2, tubeParams, n);

		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, -boxDepth/2.0 + size);
		double heightWidth2[2] = { width, boxDepth };
		p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40 + size);
		double tubeParams2[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth2, p2, tubeParams2, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40 + size);
		p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40 + size);
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);

		makeFlatRing(p2, vy, diam1, diam1 - 2*size, n);
		
		//tube just after the connector
		p1.set(0, 0, size); p2.set(0, 0, tubel);
		centers[0] = p1; centers[1] = p2;
		makeVerySimpleTube(centers, diam2, n);				
	}
	/**********************************Recover variables*******************************/
	diam1 = copydiam1; diam2 = copydiam2; boxDepth = copyboxDepth; length1 = copylength1; height = copyheight; width = copywidth;
	
	/**********************************Int Insulation*******************************/
	if (getIntInsSize(size))
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		diam1 -= 2 * size; diam2 -= 2 * size;
		boxDepth -= 2 * size; height -= 2 * size;
		width -= 2 * size;
		length1 += size;

		//make box
		FdPoint3d p1(0, 0, - boxDepth - size), p2(0, 0, -size);
		FdPoint3d centralPoints[2] = { p1, p2 };
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		bool con[2] = {false,false};
		makeBox(1,centralPoints, tabWidth,tabHeight,sides,con,true,false);
		
		//make plane with circular hole (for the grill connector)
		double heightWidth[2] = {width, height};
		double tubeParams[3] = { diam2, diam2, 0 };
		makeRectToTubeTransition(p2, vz, vx, heightWidth, p2, tubeParams, n);

		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, -boxDepth/2.0 - size);
		double heightWidth2[2] = { width, boxDepth };
		p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40 - size);
		double tubeParams2[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth2, p2, tubeParams2, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40 - size);
		p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40 - size);
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);

		makeFlatRing(p2, vy, diam1, diam1 + 2*size, n);
		
		//tube just after the connector
		p1.set(0, 0, -size); p2.set(0, 0, tubel);
		centers[0] = p1; centers[1] = p2;
		makeVerySimpleTube(centers, diam2, n);
	}
}

void GLEDiffusersAndGrillsWithBoxes::makeBSRD1(double diam1, double boxDepth, double length1, double height, double width, int n)
{
	postTransformMesh(M_PI, FdVector3d::kXAxis);
	
	//make box
	FdPoint3d p1,p2;
	p1.set(0, 0, -boxDepth); p2.set(0, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = {height,height}; //remember how perpVector works
	double tabHeight[2] = {width,width};
	bool sides[4] = {true, false, true, true};
	bool con[2] = {false,false};
	makeBox(1,centralPoints, tabWidth,tabHeight,sides,con,true,false);
	
	//make plane with circular hole (for the tube)
	p1.set(0, height/2.0, -boxDepth/2.0);
	double heightWidth[2] = {width, boxDepth};
	p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
	double tubeParams[3] = {diam1, diam1, 0};
	makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);

	//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
	p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
	p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40); 
	FdPoint3d centers[2] = { p1, p2 };
	makeVerySimpleTube(centers, diam1, n);
	
	double alfa = 30;
	double thickness = 10;
	double m = 4;
	p1.set(0,0,0);
	makeGrillType4(p1, vz, vx, (min(width, height) - 40) / 2.0, min(width, height) - 40, min(width, height), alfa, thickness, n, m, true, height, width);
	
	double frame = 25, ft = 7;;
	double A = width;	
	double B = height;
	
	double C = A + 2 * frame;
	double E = B + 2 * frame;
	
	p1.set(0, 0, ft); p2.set(0, 0, 0);
	FdPoint3d p[4] = { p1,p1,p2,p2 };
	FdVector3d v[4] =   {-vz, -vz, -vz, -vz};
	FdVector3d upv[4] = {vy, vy, vy, vy};
	double tabWidthb[4]  = {A,C,C,A};
	double tabHeightb[4] = {B,E,E,B};
	bool sidesb[12] = {true, true, true, true, true, true, true, true, true, true, true, true};
	makeBox(3, p, v, upv,tabWidthb, tabHeightb, sidesb, false, false, 5,5,0);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copyboxDepth = boxDepth, copylength1 = length1, copyheight = height, copywidth = width;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		
		diam1 += 2 * size; boxDepth += size; height += 2 * size; width += 2 * size;
		length1 -= size;
		
		//make box
		FdPoint3d p1,p2;
		p1.set(0, 0, -boxDepth); p2.set(0, 0, 0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = {vz,vz};
		FdVector3d upv[2] = {vx,vx};
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		makeBox(1,centralPoints, v, upv, tabWidth,tabHeight,sides,true,false, 5, (size > frame)?0:5, frame - size);
		
		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, -boxDepth/2.0);
		double heightWidth[2] = {width, boxDepth};
		p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
		p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40); 
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);

		makeFlatRing(p2, vy, diam1, diam1-2*size,n);
	}

	/**********************************Recover variables*******************************/
	diam1 = copydiam1; boxDepth = copyboxDepth; length1 = copylength1; height = copyheight; width = copywidth;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
	
		diam1 -= 2 * size; boxDepth -= size; height -= 2 * size; width -= 2 * size;
		length1 += size;
		
		//make box
		FdPoint3d p1,p2;
		p1.set(0, 0, -boxDepth); p2.set(0, 0, 0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = {vz,vz};
		FdVector3d upv[2] = {vx,vx};
		double tabWidth[2] = {height,height}; //remember how perpVector works
		double tabHeight[2] = {width,width};
		bool sides[4] = {true, false, true, true};
		makeBox(1,centralPoints, v, upv, tabWidth,tabHeight,sides,true,false, 5, 5, size);
		
		//make plane with circular hole (for the tube)
		p1.set(0, height/2.0, -boxDepth/2.0);
		double heightWidth[2] = {width, boxDepth};
		p2.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vy, vx, heightWidth, p2, tubeParams, n);

		//make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(0, height/2.0, -boxDepth + diam1/2.0 + 40);
		p2.set(0, height/2.0 + length1, -boxDepth + diam1/2.0 + 40); 
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);

		makeFlatRing(p2, vy, diam1, diam1+2*size,n);
	}
}

void GLEDiffusersAndGrillsWithBoxes::makeGrNIM(double d1, double d2, double h)
{
	FdPoint3d p1(0, 0, 0), p2(0, 0, -40), p3(0, 0, -45), p4(0, 0, -50), p5(0, 0, -50 - h);
	FdPoint3d CP[] = { p1, p2, p3, p4, p5, p5 };
	double diams[] = { d1, d1, d2, d1, d1, 0 };
	double numSeg = 5;

	makeStraightTube(CP, diams, 10, numSeg, true);
}

/////////////////////////////////END OF GENERAL DIFFUSERS AND GRILLS WITH BOXES FUNCTIONS///////////////////////////////////

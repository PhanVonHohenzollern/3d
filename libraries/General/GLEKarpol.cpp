#include "StdAfx.h"
#include "GeoGeneral3D.h"
#include "Geo/Int/GrillsInt.h"

#define GLEKarpol SmkGenBlockCreator

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

////////////////////////////////////////////BEGINNING OF KARPOL OUTDOR GRILES FUNCTIONS///////////////////////////////////
void GLEKarpol::makeKWO(double d1, double h1, double S, int baseN)
{

	int i = 0;
	i++;

	// make the base tube
	FdPoint3d p1(0, 0, 0), p2(0, h1, 0);
	FdPoint3d p3,p4;
	
	//first section
	makeVerySimpleTube(p1, p2, d1, baseN);

	//make bended sections
	double ratio = 1.2;
	double radius = d1 * ratio;
	double angle = 135;
	int segments = 5;
	double rang = M_PI * angle / 180.0;
	//double x = radius - (radius - d1 / 2.0) * (1 - cos(rang)) / 2.0;
	//double y = (radius + d1 / 2.0) * sin(rang) / 2.0;
	p3.set(p1.x + radius, p2.y,  0);
	makeTubularBend(p3, -vz, -vx, radius, d1, angle, baseN, segments, true);

	//make last section
	double s1 = 60;
	double rang2 = M_PI * (180 - angle) / 180.0;
	double x1 = p1.x + sin(rang2) * radius + radius;
	double y1 = p2.y + cos(rang2) * radius;
	double x2 = x1 + sin(rang2) * s1;
	double y2 = y1 - cos(rang2) * s1;

	//defining points of last sections
	FdPoint3d p8(x1,y1,0), p9(x2,y2,0);

	//and vectors
	FdVector3d rotvx1 = vx;
	rotvx1.rotateBy((180 - angle) * ARX_PI / 180 , -vz);
	FdVector3d rotvx2 = rotvx1;
	rotvx2.rotateBy( 45 * ARX_PI / 180 , -vz);


	FdPoint3d points[2] = {p8, p9};
	FdVector3d vectors[2] = {rotvx1, rotvx2};
	double diam[2][2] = {d1, d1, d1 / sin(rang2), d1};	// sin(rang2) * 

	makeTube(points, vectors, diam, 10, 1, 0, false);

	//makeFlatRing(p9, rotvx2, d1, d1 - 2 * 10, 10);

	//adding connector
	addCircularConnector(p1);

}

void GLEKarpol::makeWDPE(double a,double b,double a1,double b1,double a2,double b2,double h2 ,double h,double h1,double s)
{
		// declaration of additional variables
	// double h1 = h0/6;
	// double h2 = h0/6.6;
	// double h3 = h0/3;
	// double h4 = h0/3;
	// double d0 = d*1.15;
	// double d3 = d*1.575;
	
/*

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
	*/
	FdPoint3d p1(0, 0, 0);        
	FdPoint3d p2(0, 0, s);        
	FdPoint3d p3(0, 0, s+h1 - h2);  
	FdPoint3d p4(0, 0, s+h1);
	FdPoint3d p5(0, 0, s+2*h1);  

	FdPoint3d centralPoints0[2] = {p1, p2};
	double tabWidth0[2] = {a,a};
	double tabHeight0[2] = {b,b};
	makeBox(1, centralPoints0, tabWidth0, tabHeight0, false);

	makeConnector(p2, vz, a, b);

	FdPoint3d centralPoints1[2] = {p2, p4};
	double tabWidth1[2] = {a,a1};
	double tabHeight1[2] = {b,b1};
	makeBox(1, centralPoints1, tabWidth1, tabHeight1, false);

	makeConnector(p4, vz, a1, b1);

	FdPoint3d centralPoints2[2] = {p3, p4};
	double tabWidth2[2] = {0.01,a2};
	double tabHeight2[2] = {0.01,b2};
	makeBox(1, centralPoints2, tabWidth2, tabHeight2, false);

	FdPoint3d centralPoints3[2] = {p4, p5};
	double tabWidth3[2] = {a1,a};
	double tabHeight3[2] = {b1,b};
	makeBox(1, centralPoints3, tabWidth3, tabHeight3, false);

	makeConnector(p5, vz, a, b);

	double tubDiam = a/20;
	FdPoint3d pt1(0, -a/2-(0.1*a), s);
	FdPoint3d pt2(0, 0, s+h1-h2);
	FdPoint3d centConvPoint[2] = {pt1, pt2};
	makeSimpleTube(centConvPoint, tubDiam, tubDiam, TUB_COMP);
	
}

void GLEKarpol::makeWDOE(double d1, double d2, double d3, double h1, double h2, double h, double e , double s)
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
	FdPoint3d p2(0, 0, s);        // end point of bottom tube
	FdPoint3d p3(0, 0, s+h1);     // end point of bottom cone
	FdPoint3d p4(0, 0, s+2*h1);  // end point of top cone
	FdPoint3d p5(0, 0, s+2*h1+e);        // end point of top tube

	// bottom flange
	//makeFlatRing(p1, vz, d1, d1+20, n);

	// segment
	double segmentDiam[5] = {d1, d1, d2, d1, d1};       // diameters of each segment
	FdPoint3d centerPoint[5] = {p1, p2, p3, p4, p5};  // center points of each segment

	makeStraightTube(centerPoint, segmentDiam, 10, 4, true);

	double tubDiam = d1/10;
	FdPoint3d pt1(0, -d1/2-d1/5, s+(h1-h2)/3);
	FdPoint3d pt2(0, 0, s+h1-h2);
	FdPoint3d centConvPoint[2] = {pt1, pt2};
	makeSimpleTube(centConvPoint, tubDiam, tubDiam, TUB_COMP);

	FdPoint3d pt3(0, 0, s+h1-h2);
	FdPoint3d pt4(0, 0, s+h1);
	FdPoint3d centConvPoint2[2] = {pt3, pt4};
	makeSimpleTube(centConvPoint2, 0.01, d2, TUB_COMP);


	// top flange
	//makeFlatRing(p5, vz, d2, d3, n);

	// connector
	addCircularConnector(p1);
	addCircularConnector(p2);
	addCircularConnector(p3);
}

void GLEKarpol::makeWDPB(double a,double b, double a1, double b1, double a2, double gh, double b2 , double h1, double h2, double h3, double h)
{
	FdPoint3d pk0 (0,0,0);
	FdPoint3d pk1 (0,h1,0);
	FdPoint3d pk2 (0,h1+gh,0);
	FdPoint3d pk3 (0,h1+gh+h2,0);
	FdPoint3d pk4 (0,h1+gh+h2+h3,0);
	

	FdPoint3d centralPoints0[2] = {pk0, pk1};
	double tabWidth0[2] = {a,a};
	double tabHeight0[2] = {b,b};
	makeBox(1, centralPoints0, tabWidth0, tabHeight0, false);

	centralPoints0[0] = pk2;
	centralPoints0[1] = pk3;
	double tabWidth01[2] = {a,a};
	double tabHeight01[2] = {b,b};
	makeBox(1, centralPoints0, tabWidth01, tabHeight01, false);

	centralPoints0[0] = pk3;
	centralPoints0[1] = pk4;
	double tabWidth02[2] = {a1,0};
	double tabHeight02[2] = {b1,0};
	makeBox(1, centralPoints0, tabWidth02, tabHeight02, false);
	


	double hx = 0.01; 
	
	double delta = 30;
    FdPoint3d p1,p2;
	double smallWidth = 0.01;// + 20 * ((a - 100) / 100);
	double tabSizeA[2]  = { (a-a2)/2, (a-a2)/2 };
	double tabSizeB[2]  = { (b-b2)/2, (b-b2)/2 };
	double tabSizeSmall[2] = { hx, hx };
	bool sides1[8] = { true, true, true, true };
	bool con1[2] = { false, false };
	p1.set(b / 2  , h1, a / 2 - (a-a2)/4  );
	p2.set(b / 2 ,  h1+gh, a / 2 -(a-a2)/4  );
	FdPoint3d p[2] = { p1, p2 };
	
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);

	p1.set(b / 2 , h1, - a / 2 + (a-a2)/4 );
	p2.set(b / 2 ,  h1+gh,-  a / 2 + (a-a2)/4 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);

	p1.set(b / 2 - (b-b2)/4 , h1, -a / 2   );
	p2.set(b / 2 - (b-b2)/4,  h1+gh, -a / 2   );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);

	p1.set(-b / 2 + (b-b2)/4 , h1, a / 2   );
	p2.set(-b / 2 + (b-b2)/4,  h1+gh, a/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);


	p1.set(-b / 2  , h1, a / 2 - (a-a2)/4 );
	p2.set(-b / 2 ,  h1+gh, a / 2 - (a-a2)/4 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);


	p1.set(-b / 2  , h1, -a / 2 + (a-a2)/4 );
	p2.set(-b / 2 ,  h1+gh, -a / 2 + (a-a2)/4 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);

	p1.set(-b / 2 + (b-b2)/4 , h1, -a / 2   );
	p2.set(-b / 2 + (b-b2)/4,  h1+gh, -a/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);

	p1.set(b / 2 - (b-b2)/4 , h1, a / 2   );
	p2.set(b / 2 - (b-b2)/4,  h1+gh, a / 2   );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);


	//FdPoint3d gr1 (-b / 2 + (b-b2)/2 ,h1+gh/2, a / 2 - (a-a2)/2);

	double grWid = 50;
	int num = gh/grWid;
	FdPoint3d gr1 (b / 2 ,  h1+gh/2,0);
	FdPoint3d gr2 (-b / 2 ,  h1+gh/2,0);
	FdPoint3d gr3 (0 ,  h1+gh/2,a/2);
	FdPoint3d gr4 (0 ,  h1+gh/2,-a/2);
	FdVector3d vec1 = vx;
	FdVector3d vec2(0,1,1);
	/*vec2.rotateBy(90 * ARX_PI / 180, vx);
	vec2.rotateBy(90 * ARX_PI / 180, vy);
	vec2.rotateBy(90 * ARX_PI / 180, vz);*/
	//vec2.rotateBy(175 * ARX_PI / 180, -vy);
	


	makeGrillType6(gr1, vec1, a2, gh, num, grWid);
	makeGrillType6(gr2, vec1, a2, gh, num, grWid);
	makeGrillType6(gr3, vz,vy, b2, gh, num, grWid);
	makeGrillType6(gr4, vz,vy, b2, gh, num, grWid);
	/*void makeGrillType6(
			const FdPoint3d &centralPointD, const FdVector3d &vectorD, double L, double H, 
			double n, double a );*/

	
}


void GLEKarpol::makeCDPB(double a,double b, double a1, double b1, double a2, double gh, double b2 , double h1, double h2, double h3, double h)
{
		FdPoint3d pk0 (0,0,0);
	FdPoint3d pk1 (0,h1,0);
	FdPoint3d pk2 (0,h1+gh,0);
	FdPoint3d pk3 (0,h1+gh+h2,0);
	FdPoint3d pk4 (0,h1+gh+h2+h3,0);
	

	FdPoint3d centralPoints0[2] = {pk0, pk1};
	double tabWidth0[2] = {a,a};
	double tabHeight0[2] = {b,b};
	makeBox(1, centralPoints0, tabWidth0, tabHeight0, false);

	centralPoints0[0] = pk2;
	centralPoints0[1] = pk3;
	double tabWidth01[2] = {a,a};
	double tabHeight01[2] = {b,b};
	makeBox(1, centralPoints0, tabWidth01, tabHeight01, false);

	centralPoints0[0] = pk3;
	centralPoints0[1] = pk4;
	double tabWidth02[2] = {a1,0};
	double tabHeight02[2] = {b1,0};
	makeBox(1, centralPoints0, tabWidth02, tabHeight02, false);
	


	/*double hx = 3; 
	
	double delta = 30;
    FdPoint3d p1,p2;
	double smallWidth = 10;// + 20 * ((a - 100) / 100);
	double tabSizeA[2]  = { a-a2, a-a2 };
	double tabSizeB[2]  = { b-b2, b-b2 };
	double tabSizeSmall[2] = { hx, hx };
	bool sides1[8] = { true, true, true, true };
	bool con1[2] = { false, false };
	p1.set(b / 2  , h1, a / 2 - (a-a2)/2  );
	p2.set(b / 2 ,  h1+gh, a / 2 -(a-a2)/2  );
	FdPoint3d p[2] = { p1, p2 };
	
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);

	p1.set(b / 2 , h1, - a / 2 + (a-a2)/2 );
	p2.set(b / 2 ,  h1+gh,-  a / 2 + (a-a2)/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);

	p1.set(b / 2 - (b-b2)/2 , h1, -a / 2   );
	p2.set(b / 2 - (b-b2)/2,  h1+gh, -a / 2   );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);

	p1.set(-b / 2 + (b-b2)/2 , h1, a / 2   );
	p2.set(-b / 2 + (b-b2)/2,  h1+gh, a/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);


	p1.set(-b / 2  , h1, a / 2 - (a-a2)/2 );
	p2.set(-b / 2 ,  h1+gh, a / 2 - (a-a2)/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);


	p1.set(-b / 2  , h1, -a / 2 + (a-a2)/2 );
	p2.set(-b / 2 ,  h1+gh, -a / 2 + (a-a2)/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);

	p1.set(-b / 2 + (b-b2)/2 , h1, -a / 2   );
	p2.set(-b / 2 + (b-b2)/2,  h1+gh, -a/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);

	p1.set(b / 2 - (b-b2)/2 , h1, a / 2   );
	p2.set(b / 2 - (b-b2)/2,  h1+gh, a / 2   );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);

	//FdPoint3d gr1 (-b / 2 + (b-b2)/2 ,h1+gh/2, a / 2 - (a-a2)/2);*/

	double grWid = 50;
	int num = gh/grWid;
	FdPoint3d gr1 (b / 2 ,  h1+gh/2,0);
	FdPoint3d gr2 (-b / 2 ,  h1+gh/2,0);
	FdPoint3d gr3 (0 ,  h1+gh/2,a/2);
	FdPoint3d gr4 (0 ,  h1+gh/2,-a/2);
	FdVector3d vec1 = vx;
	FdVector3d vec2(0,1,1);
	/*vec2.rotateBy(90 * ARX_PI / 180, vx);
	vec2.rotateBy(90 * ARX_PI / 180, vy);
	vec2.rotateBy(90 * ARX_PI / 180, vz);*/
	//vec2.rotateBy(175 * ARX_PI / 180, -vy);
	


	makeGrillType6(gr1, vec1, a2 + (a-a2)/2 - 10, gh, num, grWid);
	makeGrillType6(gr2, vec1, a2 + (a-a2)/2 - 10 , gh, num, grWid);
	makeGrillType6(gr3, vz,vy, b2 + (b-b2)/2- 10 , gh, num, grWid);
	makeGrillType6(gr4, vz,vy, b2 + (b-b2)/2 - 10, gh, num, grWid);
}


void GLEKarpol::makeWDPA(double a, double b, double c, double d, double x, double y, double z ,double h, double h2, double s, double s1)
{
	//h3-h
	//h2-s1
	//h4-h2

	double tmp = s;
	s = h2;
	h2 = tmp;
	s1 = 239;

	s= h+z+s1;

	FdPoint3d pk0 (0,0,0);
	FdPoint3d pk1 (0,h,0);
	FdPoint3d pk2 (0,h+s1-h2*0.53,0);
	FdPoint3d pk3 (0,h+s1,0);
	FdPoint3d pk4 (0,h+s1+h2*0.47 - 10,0);
	FdPoint3d pk5 (0,h+z+s1,0);

	FdPoint3d centralPoints0[2] = {pk0, pk1};
	double tabWidth0[2] = {a,a};
	double tabHeight0[2] = {b,b};
	makeBox(1, centralPoints0, tabWidth0, tabHeight0, false);

	centralPoints0[0] = pk2;
	centralPoints0[1] = pk4;
	double tabWidth01[2] = {0,x};
	double tabHeight01[2] = {0,y};
	makeBox(1, centralPoints0, tabWidth01, tabHeight01, false);

	centralPoints0[0] = pk3;
	centralPoints0[1] = pk5;
	double tabWidth02[2] = {c,0};
	double tabHeight02[2] = {d,0};
	makeBox(1, centralPoints0, tabWidth02, tabHeight02, false);
	


	double hx = 10; 
	double L = s - 30;
	double delta = 30;
    FdPoint3d p1,p2;
	double smallWidth = 10;// + 20 * ((a - 100) / 100);
	p1.set(-b / 2 , delta, a / 2 - 20 * (a / 100) );
	p2.set(-b / 2 ,  h+z + delta, a / 2 - 20 * (a / 100) );
	FdPoint3d p[2] = { p1, p2 };
	double tabWidth1[2]  = { smallWidth, smallWidth };
	double tabHeight1[2] = { hx, hx };
	bool sides1[8] = { true, true, true, true };
	bool con1[2] = { false, false };
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);

	p1.set(-b / 2 , delta, - a / 2 + 20 * (a / 100) );
	p2.set(-b / 2 ,  h+z + delta,-  a / 2 + 20 * (a / 100) );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);

	p1.set(b / 2 , delta, a / 2 - 20 * (a / 100) );
	p2.set(b / 2 ,  h+z+delta, a / 2 - 20 * (a / 100) );
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);

	p1.set(b / 2 , delta, -a / 2 + 20 * (a / 100) );
	p2.set(b / 2 ,  h+z+delta, -a / 2 + 20 * (a / 100) );
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);

	p1.set(-b / 2 + 20 * (b / 100), delta, a / 2 );
	p2.set(-b / 2 + 20 * (b / 100),  h+z+delta, a / 2  );
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);

	p1.set(b / 2 - 20 * (b / 100), delta, a / 2  );
	p2.set(b / 2 - 20 * (b / 100),  h+z+delta, a / 2  );
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);
	
	
	
	
	p1.set(b / 2 - 20 * (b / 100), delta, -a / 2  );
	p2.set(b / 2 - 20 * (b / 100),  h+z+delta, -a / 2  );
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);

	p1.set(-b / 2  + 20 * (b / 100), delta, -a / 2  );
	p2.set(-b / 2 + 20 * (b / 100),  h+z+delta, -a / 2  );
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, tabWidth1, tabHeight1, sides1, con1, true, true);


}
void GLEKarpol::makeWC(double d1, double d2 , double d3 , double d4, double s1, double h, double h2 ,double h3, double l2, double l3)
{

	double tmp = h;
	h = s1;
	s1 = tmp;
	FdPoint3d p0(0, 0, 0);
	FdPoint3d p1(0, 0, l2);
	FdPoint3d p2(0, 0, s1-h);
	FdPoint3d p3(0, 0, s1 - h +l3);
	FdPoint3d p4(0, 0, l2+h3);
	FdPoint3d p5(0, 0, s1-l3);
	FdPoint3d p6(0, 0, s1);
	FdPoint3d px(0, 0, s1-h2);
	//d1=100;
	double  wid = d1/20;
	

	FdPoint3d centConvPoint[2] = {p0, p1};
	makeSimpleTube(centConvPoint, d1, d1, TUB_COMP);

	FdPoint3d centConvPoint2[2] = {p1, p4};
	makeSimpleTube(centConvPoint2, d1, d2, TUB_COMP);

	FdPoint3d centConvPoint3[2] = {p2, p6};
	makeSimpleTube(centConvPoint3, d4, d4, TUB_COMP);

	FdPoint3d centConvPoint4[2] = {px, p6};
	makeSimpleTube(centConvPoint4, d3, 0, TUB_COMP);

	makeFlatRing(p1, vz, d1, d1+RING_WID, TUB_COMP);
	makeFlatRing(p3, vz, d4, d4+RING_WID, TUB_COMP);
	makeFlatRing(p5, vz, d4, d4+RING_WID, TUB_COMP);
    FdPoint3d rotPoint(0, 0, 0);
	int count = 0;
	while(count<4)
	{
		p1.set(d2/2, wid/2, h3+l2);
		p2.set(d2/2, -wid/2, h3+l2);
		p3.set(d3/2, -wid/2, s1-h2);
		p4.set(d3/2, wid/2, s1-h2);
		
		//p1.set(h3+l2, 0, d2/2); (d2/2, 0, h3+l2);
		//p2.set(h3+l2, 0, d2/2); (d2/2, 0, h3+l2);
		//p3.set(s1-h2, 0, d3/2);
		///p4.set(s1-h2, 0, d3/2);


		FdPoint3d points2[4] = {p1,p2,p3,p4};
		makeRotatablePlane(points2, vz, rotPoint, 90*count);
		count++;
	}
	addCircularConnector(FdPoint3d::kOrigin);
}

void GLEKarpol::makeCP(double a, double b, double a0, double b0, double h0,double h2, double f0, double alfa)
{
	// declaration of additional variables
	long double radAlfa = alfa*M_PI/180;

	double dz = 0.5*b0*tan(radAlfa);     // start point of main box (on z axis)
	double df = f0/cos(radAlfa);
	double b1 =	(2*f0+b0)/cos(radAlfa);  // width of bottom rect plane
	double a1 = 2*f0+a0;                 // height of bottom rect. plane
	double b2 = b0/cos(radAlfa);         // width of the pottom flange
	double a2 = a0;                      // height of the bottom flange

	// declaration of start / center points
	FdPoint3d p0(0, 0, -dz);             // start point of bottom box
	FdPoint3d p1(0, 0, 0);               // start point of plane
	FdPoint3d p2(0, 0, dz);              // start point of top box
	FdPoint3d p3(0, 0, h0+dz);           // end point of element
	FdPoint3d p4(0, 0, h0+dz);

	FdVector3d v1(-1, 0, -tan(0.5*M_PI-radAlfa));  // normalized normal vector to bottom plane

	// main box
	double tabHeight[5] = {a1, a2, a0, a};
	double tabWidth[5] = {b1, b2, b0, b};

	FdPoint3d centralPoints[5] = {p1, p1, p3, p4};

	FdVector3d vectorsD[6] = { v1, v1, -vz, -vz} ;
	FdVector3d vectorsUp[6] = {-vy, -vy, -vy, -vy};

	bool sides[24] = { true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true };
	bool connectors[2] = { false, false };

	makeBox(3,centralPoints,vectorsD,vectorsUp,tabWidth,tabHeight,sides,false,false,5,5,0);
}
void GLEKarpol::makeCDPA(double a, double b,double  a1, double b1, double a2, double b2, double h1 ,double h2,double  h3,double  h)
{

	/*double tmp = s;
	s = h2;
	h2 = tmp;
	s1 = 239;

	s= h+z+s1;*/

	FdPoint3d pk0 (0,0,0);
	FdPoint3d pk1 (0,h3,0);
	FdPoint3d pk2 (0,h3+h2,0);
	FdPoint3d pk3 (0,h3+h2+h1/3-10,0);
	FdPoint3d pk4 (0,h3+h2+h1,0);
	

	FdPoint3d centralPoints0[2] = {pk0, pk1};
	double tabWidth0[2] = {a,a};
	double tabHeight0[2] = {b,b};
	makeBox(1, centralPoints0, tabWidth0, tabHeight0, false);

	centralPoints0[0] = pk2;
	centralPoints0[1] = pk3;
	double tabWidth01[2] = {a,a};
	double tabHeight01[2] = {b,b};
	makeBox(1, centralPoints0, tabWidth01, tabHeight01, false);

	centralPoints0[0] = pk2;
	centralPoints0[1] = pk4;
	double tabWidth02[2] = {a1,1};
	double tabHeight02[2] = {b1,1};
	makeBox(1, centralPoints0, tabWidth02, tabHeight02, false);
	


	double hx = 3; 
	
	double delta = 30;
    FdPoint3d p1,p2;
	double smallWidth = 10;// + 20 * ((a - 100) / 100);
	double tabSizeA[2]  = { a-a2, a-a2 };
	double tabSizeB[2]  = { b-b2, b-b2 };
	double tabSizeSmall[2] = { hx, hx };
	bool sides1[8] = { true, true, true, true };
	bool con1[2] = { false, false };
	p1.set(b / 2  , h3, a / 2 - (a-a2)/2  );
	p2.set(b / 2 ,  h3+h2, a / 2 -(a-a2)/2  );
	FdPoint3d p[2] = { p1, p2 };
	
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);

	p1.set(b / 2 , h3, - a / 2 + (a-a2)/2 );
	p2.set(b / 2 ,  h3+h2,-  a / 2 + (a-a2)/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);

	p1.set(b / 2 - (b-b2)/2 , h3, -a / 2   );
	p2.set(b / 2 - (b-b2)/2,  h3+h2, -a / 2   );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);

	p1.set(-b / 2 + (b-b2)/2 , h3, a / 2   );
	p2.set(-b / 2 + (b-b2)/2,  h3+h2, a/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);


	p1.set(-b / 2  , h3, a / 2 - (a-a2)/2 );
	p2.set(-b / 2 ,  h3+h2, a / 2 - (a-a2)/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);


	p1.set(-b / 2  , h3, -a / 2 + (a-a2)/2 );
	p2.set(-b / 2 ,  h3+h2, -a / 2 + (a-a2)/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeA, tabSizeSmall, sides1, con1, true, true);

	p1.set(-b / 2 + (b-b2)/2 , h3, -a / 2   );
	p2.set(-b / 2 + (b-b2)/2,  h3+h2, -a/2 );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);

	p1.set(b / 2 - (b-b2)/2 , h3, a / 2   );
	p2.set(b / 2 - (b-b2)/2,  h3+h2, a / 2   );
	p[0] = p1;   p[1] = p2;
	makeBox(1, p, tabSizeSmall, tabSizeB, sides1, con1, true, true);

	
}
void GLEKarpol::makePDOBI(double d1,double d2,double h1,double h2,double h3,double a ,double b)
{

	int count = 2;
	double trapez = 100;

	FdPoint3d p1(0,0,0);
	FdPoint3d p2(0,h1,0);
	FdPoint3d p3(0,h1+h2,0);
	FdPoint3d p4(0,h1+h2+h3,0);
	


	FdPoint3d centralPoints0[2] = {p1, p2};
	double tabWidth0[2] = {a+trapez,a};
	double tabHeight0[2] = {b+ trapez,b};
	makeBox(1, centralPoints0, tabWidth0, tabHeight0, false);

	
	double heightWidth2[2] = {a, b};
	double tubeParams[3] = {d1, d1, 1};
	makeRectToTubeTransition(p2, vy, vz, heightWidth2, p2, tubeParams, TUB_COMP);


	FdPoint3d centConvPoint[2] = {p2, p3};
	makeSimpleTube(centConvPoint, d2, d1, TUB_COMP);

	FdPoint3d centConvPoint1[2] = {p3, p4};
	makeSimpleTube(centConvPoint1, d1, d1, TUB_COMP);

	makeFlatRing(p4, vy, d1, d1+RING_WID_EXTRA , TUB_COMP);


}
void GLEKarpol::makePDOBII(double d1,double d2,double h1, double h2,double h3,double a ,double b,double L)
{
	int count = 2;
	double trapez = 100;

	FdPoint3d p0(0,-(L-(h1+h2+h3)),0);
	FdPoint3d p1(0,0,0);
	FdPoint3d p2(0,h1,0);
	FdPoint3d p3(0,h1+h2,0);
	FdPoint3d p4(0,h1+h2+h3,0);
	

	FdPoint3d centConvPointPre[2] = {p0, p2};
	makeSimpleTube(centConvPointPre, d1, d1, TUB_COMP);

	FdPoint3d centralPoints0[2] = {p1, p2};
	double tabWidth0[2] = {a+trapez,a};
	double tabHeight0[2] = {b+ trapez,b};
	makeBox(1, centralPoints0, tabWidth0, tabHeight0, false);

	double heightWidth2[2] = {a, b};
	double tubeParams[3] = {d1, d1, 1};
	makeRectToTubeTransition(p2, vy, vz, heightWidth2, p2, tubeParams, TUB_COMP);

	FdPoint3d centConvPoint[2] = {p2, p3};
	makeSimpleTube(centConvPoint, d2, d1, TUB_COMP);

	FdPoint3d centConvPoint1[2] = {p3, p4};
	makeSimpleTube(centConvPoint1, d1, d1, TUB_COMP);

	makeFlatRing(p4, vy, d1, d1+RING_WID_EXTRA , TUB_COMP);
}
void GLEKarpol::makeWDOC(double d1, double d2, double d3, double h1, double h2, double h3, double L)
{

	double l2 = L;

	FdPoint3d p0(0, 0, 0);
	FdPoint3d p1(0, 0, l2);
	FdPoint3d p2(0, 0, 2*l2);
	FdPoint3d p3(0, 0, 2*l2 + h1- h2 * 0.47); // /2.0
	FdPoint3d p4(0, 0, 2*l2 + h1);
	FdPoint3d p5(0, 0, 2*l2 + h1 + h2 * 0.47);
	FdPoint3d p6(0, 0, 2*l2 + h1 + h2);

	FdPoint3d centConvPoint[2] = {p0, p2};
	makeSimpleTube(centConvPoint, d1, d1, TUB_COMP);

	FdPoint3d centConvPoint2[2] = {p5, p3};
	makeSimpleTube(centConvPoint2, d3, 0.01, TUB_COMP);

	FdPoint3d centConvPoint3[2] = {p4, p6};
	makeSimpleTube(centConvPoint3, d2, 0.01, TUB_COMP);

	makeFlatRing(p1, vz, d1, d1+RING_WID, TUB_COMP);

	 FdPoint3d rotPoint(0, 0, 0);
	int count = 0;
	double wid = d1/20;
	while(count<4)
	{
		p1.set(d1/2, wid/2, 2*l2);
		p2.set(d1/2, -wid/2, 2*l2);
		p3.set(d2/2 - (d2-d3)/4, -wid/2, 2*l2 + h1 + h2/3);
		p4.set(d2/2 - (d2-d3)/4, wid/2, 2*l2 + h1 + h2/3);
		
		//p1.set(h3+l2, 0, d2/2); (d2/2, 0, h3+l2);
		//p2.set(h3+l2, 0, d2/2); (d2/2, 0, h3+l2);
		//p3.set(s1-h2, 0, d3/2);
		///p4.set(s1-h2, 0, d3/2);


		FdPoint3d points2[4] = {p1,p2,p3,p4};
		makeRotatablePlane(points2, vz, rotPoint, 90*count);
		count++;
	}
	addCircularConnector(FdPoint3d::kOrigin);
	
}
void GLEKarpol::makeCDOC(double d1, double d2,double  h2,double h1, double L)
{
	FdPoint3d p0(0, 0, 0);
	FdPoint3d p1(0, 0, L);
	FdPoint3d p2(0, 0, 2*L);
	FdPoint3d p3(0, 0, 2*L+h1);
	FdPoint3d p4(0, 0, 2*L + h2);


	FdPoint3d centConvPoint[2] = {p0, p2};
	makeSimpleTube(centConvPoint, d1, d1, TUB_COMP);

	FdPoint3d centConvPoint2[2] = {p3, p4};
	makeSimpleTube(centConvPoint2, d2, 0, TUB_COMP);

	makeFlatRing(p1, vz, d1, d1+RING_WID, TUB_COMP);

	FdPoint3d rotPoint(0, 0, 0);
	int count = 0;
	double wid = d1/20;
	while(count<3)
	{
		p1.set(d1/2, wid/10, L+CDOCdelta);
		p2.set(d1/2, -wid/10, L+CDOCdelta);
		p3.set(d1/2, -wid/10, 2*L + h1 +CDOCdelta );
		p4.set(d1/2, wid/10,  2*L + h1 + CDOCdelta );
		
		//p1.set(h3+l2, 0, d2/2); (d2/2, 0, h3+l2);
		//p2.set(h3+l2, 0, d2/2); (d2/2, 0, h3+l2);
		//p3.set(s1-h2, 0, d3/2);
		///p4.set(s1-h2, 0, d3/2);


		FdPoint3d points2[4] = {p1,p2,p3,p4};
		makeRotatablePlane(points2, vz, rotPoint, 120*count);
		count++;
	}
	addCircularConnector(FdPoint3d::kOrigin);
}
void GLEKarpol::makePDPAI(double a, double b, double c, double d, double x, double y, double h1, double h2,double X)
{
	int count = 2;

	FdPoint3d p1(0,0,0);
	FdPoint3d p2(0,h1,0);
	FdPoint3d p3(0,h1+h2 - GEN_UNKN_SIZE,0);
	FdPoint3d p4(0,h1+h2,0);
	


	FdPoint3d centralPoints0[2] = {p1, p2};
	FdPoint3d centralPoints1[3] = {p2,p3, p4};


	double tabWidth0[2] = {c+X,c};
	double tabHeight0[2] = {d+X,d};

	double tabWidth1[3] = {c,a,a};
	double tabHeight1[3] = {d,b,b};

	makeBox(1, centralPoints0, tabWidth0, tabHeight0, false);
	makeBox(count, centralPoints1, tabWidth1, tabHeight1, false);

}
void GLEKarpol::makePDPAII(double a,double  b,double c,double d,double x, double y, double h1, double h2,double X, double L)
{
	int count = 2;

	//L=1000;
	FdPoint3d p0(0,-(L-h1-h2),0);
	FdPoint3d p1(0,0,0);
	FdPoint3d p2(0,h1,0);
	FdPoint3d p3(0,h1+h2 - GEN_UNKN_SIZE,0);
	FdPoint3d p4(0,h1+h2,0);
	

	FdPoint3d centralPointsPre[2] = {p0, p3};
	FdPoint3d centralPoints0[2] = {p1, p2};
	FdPoint3d centralPoints1[3] = {p2,p3, p4};

	double tabWidthPre[2] = {a,a};
	double tabHeightPre[2] = {b,b};


	double tabWidth0[2] = {c+X,c};
	double tabHeight0[2] = {d+X,d};

	double tabWidth1[3] = {c,a,a};
	double tabHeight1[3] = {d,b,b};

	makeBox(1, centralPointsPre, tabWidthPre, tabHeightPre, false);
	makeBox(1, centralPoints0, tabWidth0, tabHeight0, false);
	makeBox(count, centralPoints1, tabWidth1, tabHeight1, false);
}
void GLEKarpol::makeKWP(double a, double b, double a1, double b1, double e, double f, double g, double r)
{
 FdPoint3d p00(0, 0, 0);
 FdPoint3d p01(0, e, 0);

 FdPoint3d p[] = {p00, p01};
 double tabW[] = {a, a};
 double tabH[] = {b, b};
 bool sides[4] = {true, true, true, true};

 makeBox(1, p, tabH, tabW, false);
 makeBend2(p01, -vy, -vz, sides, false, g, g, a, b, a1, TUB_COMP, r, true, false);
 makeConnector(p00, vy, b, a);
}

void GLEKarpol::makeCDPK(double a,double b,double a1,double b1,double h1,double h2, double h3, double h4,double h)
{


	FdPoint3d p1(0, 0, 0), p2(0, h2, 0), p3(0, h3, 0);

	FdPoint3d centralPoint[3] = { p1, p2 };
	double tabWidth[2] = { a, a };
	double tabHeight[2] = { b, b};

	makeBox(1, centralPoint, tabWidth, tabHeight, false);

	p1.set(0, h - h3, 0);
	p2.set(0, h, 0);
	FdPoint3d p[2];
	p[0] = p1;  p[1] = p2;
	double tabWidthC[2]  = { a1, 0.001 };
	double tabHeightC[2] = { b1, 0.001 };
	bool sidesC[8] = { true, true, true, true };
	bool conC[2] = { false, false };
	makeBox(1, p, tabWidthC, tabHeightC, sidesC, conC, false, true);

	p1.set(0, h2, 0);
	p2.set(0, h-h3, 0);
	p[0] = p1;  p[1] = p2;
	double tabWidthC1[2]  = { a1, a1 };
	double tabHeightC1[2] = { b1, b1 };
	makeBox(1, p, tabWidthC1, tabHeightC1, false);

}
void GLEKarpol::makeSK(double a, double b, double a1, double b1, double l, double l1,double g)
{


FdPoint3d p0 (0, b/2, a/2);
FdPoint3d p1 (l + l1/2, b/2, a/2);
FdPoint3d p[] = {p0,p1};

FdVector3d v1 = vx;
FdVector3d v2 = vx;
v2.rotateBy( 45 * ARX_PI / 180 , vy);
FdVector3d v[] = {v1,v2};

FdVector3d vUp1 = vy;
FdVector3d vUp2 = vy;
FdVector3d vUp[] = {vUp1,vUp2};

double width [] = {a,a1};
double height [] = {b,b1};

bool sides [4] = {true,true, true, true};
bool edges [3][4] = {true,true, true, true, true,true, true, true, true,true, true, true};

makeBox(1, p, v, vUp, width, height, sides, edges, false, false, 5,5, CONNECTOR_WIDTH);


}


void GLEKarpol::makeARE45(double d1, double d2, double d3, double l1, double l2, double l3)
{
	double length1 = l1, length2 = 0, length3 = l3;
	double diam1 = d1, diam2 = d2, diam3 = d3;
	double deltaL = l1/10;
	double angle = 45;

	FdPoint3d p1, p2, p3, p4, p5, p6;
	double tubeData[2] = {diam1, length1+length2*2};
	double interTubeData[4] = {diam3, length3, tubeData[1]/2-diam1/2, 0};
	double angles[2] = {angle, 270};
	
	int n = 16;

	//---define the directional vector for both tee intersection functions
	p1.set(-(length1+length2*2)/2, 0, 0);
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

	//---define the center line and connecctor of the intersecting tube
	p1.set(-(length1+length2*2)/2+tubeData[1]/2-diam1/2, 0, 0);
	p2.set(-(length1+length2*2)/2+tubeData[1]/2-diam1/2+cos(angle*(M_PI/180))*length3, sin(angle*(M_PI/180))*length3, 0);
	addCenterLine(p1, p2);
	
	p1.set(-(length1+length2*2)/2+tubeData[1]/2-diam1/2+cos(angle*(M_PI/180))*length3, sin(angle*(M_PI/180))*length3, 0);
	addCircularConnector(p1);

	//---if intersecting diam >= main, we actually get ellipses at the saddle of the intersection,
	//---not splines, so we must remember to specify that these should be thin
	if( diam3 == diam1 )
		p3.set(-length1/2+tubeData[1]/2-diam1/2, 0, 0);
		drawAsThinArc(p3);
	if( diam3 > diam1 )
		p3.set(p1.x + interTubeData[2], 0, 0);
		drawAsThinArc(p3);

	setHlrSplineType(hlrThin);
	
	p3.set(-(length1+length2*2)/2, 0, 0);
	addCircularConnector(p3);
	
	p3.set(-(length1+length2*2)/2, 0, 0);
	p4.set((length1+length2*2)/2, 0, 0);
	p5.set(p4.x + length1/10, 0, 0);
	p6.set(p5.x + length1/10, 0, 0);
	addCircularConnector(p6);
	addCenterLine(p3, p6);

	FdPoint3d centConvPoint1[2] = {p4, p5};
	FdPoint3d centConvPoint2[2] = {p5, p6};
	makeSimpleTube(centConvPoint1, d1, d2, TUB_COMP);
	makeSimpleTube(centConvPoint2, d2, d2, TUB_COMP);

}


void GLEKarpol::makeRRD(double d1, double a, double b, double h, double h1, double h2, double l, double f,
                        double c, double d, double a0, double b0, double n)
{
	h = d1/2 + h;
	//FdPoint3d s1(-a/2, 0, 0), s2(a/2, 0, 0);	// end points for cap (short side)

	FdPoint3d s0(-b, 0, 0);					// center points for tube

	double tubeParams[3] = {d1, d1, 2*b};
	double positions[2] = {b, 0};
	double holeParams[3] = {a, b, h};
	bool bools[2] = {false, false};
	makeRectToTubeIntersection(s0, vx, -vz, tubeParams, positions, holeParams, n);

	//endcap of the cap
	FdPoint3d p1(0, h, 0), p2(0, h+0.01, 0);			// endpoints points for handle
	FdPoint3d centralPoints[2] = {p1, p2};
	
	double tabWidth[2] = {b, 0.01};
	double tabHeight[2] = {a, 0.01};

	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	// handle
	FdPoint3d s3(-(f/2-l/2), h, 0), s4(-(f/2-l/2), (h+h1), 0);  // points of tube 1 part of handle
	FdPoint3d s5((f/2-l/2), h, 0), s6((f/2-l/2), (h+h1), 0);    // points of tube 2 part of handle

	FdPoint3d t1CPoints[3] = {s3, s4, s4};  // center points of tube 1
	FdPoint3d t2CPoints[3] = {s5, s6, s6};  // center points of tube 2

	FdVector3d t1NVect[3] = {vy, vy, vy};
	FdVector3d t2NVect[3] = {vy, vy, vy};
	FdVector3d t1UVect[3] = {-vz, -vz, -vz};
	FdVector3d t2UVect[3] = {vz, vz, vz};
	double tDiam[3][2] = { l, l, l, l,
	                       0.00, 0.00 };

	makeTube(t1CPoints, t1NVect, t1UVect, tDiam, n, 2, true, true);  // tube 1
	makeTube(t2CPoints, t2NVect, t2UVect, tDiam, n, 2, true, true);  // tube 2

	// handle connecting box
	FdPoint3d p3(0, h, 0), p4(0, (h+h1), 0);
	FdPoint3d cbCentPoints[2] = {p3, p4};

	double cbTabWidth[2] = {l, l};
	double cbTabHeight[2] = {f-l, f-l};
	bool cbSides[4] = {false, true, false, true};
	bool cbConnectors[2] = {false, false};

	makeBox(1, cbCentPoints, cbTabWidth, cbTabHeight, cbSides, cbConnectors, false, true);

	// symbolic circles
	FdPoint3d s7(-c/2, (h+h1), 0), s8(c/2, (h+h1), 0);
	makeSymbolicCircle(s7, vy, d);
	makeSymbolicCircle(s8, vy, d);

	// deleting additional lines
	FdPoint3d p5(-(f/2-l/2), (h+h1), -l/2), p6(-(f/2-l/2), (h+h1), l/2);
	FdPoint3d p7((f/2-l/2), (h+h1), -l/2), p8((f/2-l/2), (h+h1), l/2);

	addEraseLine(p5, p6);
	addEraseLine(p7, p8);
}

void GLEKarpol::makeKST(double L, double H, double n, double a, double thickness)
{
	//--- Make the connecting box.
	FdPoint3d p1(0, 0, 0), p2(40, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabHeight[2] = { H, H };
	double tabWidth[2]  = { L, L };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, H, L);

	//--- Make the grill.
	makeGrillType6(p1, vx, vz, H, L, n, a);
}
///////////////////////////////////////////////END OF KARPOL OUTDOR FUNCTIONS///////////////////////////////////

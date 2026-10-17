#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define GLEAccesories SmkGenBlockCreator

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

#define fo 30


////////////////////////////////////////////BEGINNING OF GENERAL ACCESORIES FUNCTIONS///////////////////////////////////
void GLEAccesories::makeCD1(double L, double D, double tubeN, double W, double disc_t, double discN, double  H, double h, double alpha, double handle_offset, double g, double stem_l, double stem_t, double stemN, double e)
{
	FdPoint3d p1, p2, p3, p4;

	/**********************************Ext Insulation*******************************/
	double size = 0;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		// make main tube
		p1.set(-L/2, 0, 0); p2.set(L/2, 0, 0);
		FdPoint3d centers[2] = {p1,p2};
		makeVerySimpleTube(centers, D+2*size, tubeN);

		makeFlatRing(p1, vx, D, D+2*size, tubeN);
		makeFlatRing(p2, vx, D, D+2*size, tubeN);

		stem_l += size;  handle_offset += size;

		setPrimitiveMode(FLM3Geo::pmNormal);
	}

	// make stem
	p1.set(L/2-W, 0, -D/2+stem_t);
	p2.set(L/2-W, 0, -D/2+stem_t);
	p3.set(L/2-W, 0, -D/2+stem_l);
	p4.set(L/2-W, 0, -D/2+stem_l);
	FdPoint3d centers3[4] = {p1,p2,p3,p4};
	double diams3[4] = {.000001, stem_t, stem_t, .000001};
	makeUniVectorTube(centers3, vz, diams3, stemN, 3, true);

	// make main tube
	p1.set(-L/2, 0, 0); p2.set(L/2, 0, 0);
	FdPoint3d centers[2] = {p1,p2};
	makeVerySimpleTube(centers, D, tubeN);

	// make disc
	p1.set(L/2-W, 0, 0);
	makeDisc(p1, vy, D-2*disc_t, disc_t, discN, true);

	// make handle
	p1.set(L/2-W-h/2, 8, D/2+handle_offset);
	p2.set(L/2-W+h/2, 8, D/2+handle_offset);
	p3.set(L/2-W+h/2, 8-g, D/2+handle_offset);
	p4.set(L/2-W-h/2, 8-g, D/2+handle_offset);
	FdPoint3d points[4] = {p1,p2,p3,p4};
	p1.set(L/2-W, 0, 0);
	makeRotatablePlane(points, vz, p1, alpha);

	// make side plate
	p1.set(L/2-W-H/2, -H/2, D/2 + size);
	p2.set(L/2-W+H/2, -H/2, D/2 + size);
	p3.set(L/2-W+H/2, H/2, D/2 + size);
	p4.set(L/2-W-H/2, H/2, D/2 + size);
	FdPoint3d points2[4] ={p1,p2,p3,p4};
	makePlane(points2, false);

	p1.set(-L/2, 0, 0);
	addCircularConnector(p1);

	p1.set(L/2, 0, 0);
	addCircularConnector(p1);
}

void GLEAccesories::makeCF1(double diam1, double length1, double length2, double heightWidth, int n)
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
	makeReversedSigma(p1, vz, vy, heightWidth, (length1-length2*2)/4);

	p1.set(0, heightWidth/2, 0);
	makeReversedSigma(p1, vy, -vz, heightWidth, (length1-length2*2)/4);

	p1.set(0, 0, -heightWidth/2);
	makeReversedSigma(p1, -vz, -vy, heightWidth, (length1-length2*2)/4);

	p1.set(0, -heightWidth/2, 0);
	makeReversedSigma(p1, -vy, vz, heightWidth, (length1-length2*2)/4);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		diam1 += 2*size; heightWidth += 2 * size;
		/* length1 -= size; */ length2 -= size;

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

void GLEAccesories::makeCFC(double diam1, double diam2, double diam3, double length1, double length2, double length3, int n)
{
	/**********************************Int Insulation*******************************/
	double size;
	if( getIntInsSize(size) )
	{
		diam1 += 2*size; diam2 += 2*size; diam3 += 2*size;

		FdPoint3d p1,p2;

		p1.set(-length1/2, 0, 0);
		addCircularConnector(p1);

		p2.set(length1/2, 0, 0);
		addCircularConnector(p1);

		addCenterLine(p1, p2);

		//--- if the length is less than 80 then this is one continuous tube
		if( length1 < 80 )
		{
			p1.set(-length1/2, 0, 0);
			p2.set(length1/2, 0, 0);
			FdPoint3d centers[2] = {p1,p2};
			makeVerySimpleTube(centers, diam1, n);
		}
		//--- otherwise it's more complicated :)
		else
		{
			int numOfSegs = length1 / 20;

			FdPoint3d (*centers) = new FdPoint3d[numOfSegs + 1];
			double *diams = new double[numOfSegs+1];

			centers[0].x = -length1/2; centers[0].y = 0; centers[0].z = 0;
			diams[0] = diam1;
			centers[1].x = -length1/2+20; centers[1].y = 0; centers[1].z = 0;
			diams[1] = diam1;

			double l = length1;
			int max = 2*((int)((l-40)/40));
			double dx1 = 20, 				dy1 = 0;
			double dx2 = 20+1*(l-40)/max,	dy2 = (l-40)/max;
			centers[2].x = -length1/2+dx2; centers[2].y = 0; centers[2].z = 0;
			diams[2] = diam1+dy2*2;

			p1.set(-length1/2+dx2, 0, 0);
			drawAsThinArc(p1);

			int dir = 1, segCount = 3;
			for(int cnt = 1; cnt + 2 < max; cnt += 2 )
			{
				dx1 = 20+cnt*(l-40)/max;	dy1 =  dir*(l-40)/max;
				dx2 = 20+(cnt+2)*(l-40)/max;	dy2 = -dir*(l-40)/max;
				centers[segCount][0] = -l/2+dx2; centers[segCount][1] = 0; centers[segCount][2] = 0;
				diams[segCount] = diam1+dy2*2;

				p1.set(-l/2+dx2, 0, 0);
				drawAsThinArc(p1);
				dir *= -1;
				segCount++;
			}

			centers[segCount][0] = l/2-20; centers[segCount][1] = 0; centers[segCount][2] = 0;
			diams[segCount] = diam1;
			centers[segCount+1][0] = l/2; centers[segCount+1][1] = 0; centers[segCount+1][2] = 0;
			diams[segCount+1] = diam1;

			numOfSegs = segCount+1;
			makeStraightTube(centers, diams, n, numOfSegs, true);

			delete[] centers;
			delete[] diams;

			if (true)
			{
				diam1 -= 2*size; diam2 -= 2*size; diam3 -= 2*size;
				setPrimitiveMode(FLM3Geo::pmIntInsulation);

				p1.set(-length1/2, 0, 0);
				p2.set(length1/2, 0, 0);

				makeFlatRing(p1, vx, diam1, diam1 + 2*size, n);
				makeFlatRing(p2, vx, diam1, diam1 + 2*size, n);

						FdPoint3d p1,p2;

				p1.set(-length1/2, 0, 0);
				addCircularConnector(p1);

				p2.set(length1/2, 0, 0);
				addCircularConnector(p1);

				addCenterLine(p1, p2);

				//--- if the length is less than 80 then this is one continuous tube
				if( length1 < 80 )
				{
					p1.set(-length1/2, 0, 0);
					p2.set(length1/2, 0, 0);
					FdPoint3d centers[2] = {p1,p2};
					makeVerySimpleTube(centers, diam1, n);
				}
				//--- otherwise it's more complicated :)
				else
				{
					int numOfSegs = length1 / 20;

					FdPoint3d (*centers) = new FdPoint3d[numOfSegs + 1];
					double *diams = new double[numOfSegs+1];

					centers[0].x = -length1/2; centers[0].y = 0; centers[0].z = 0;
					diams[0] = diam1;
					centers[1].x = -length1/2+20; centers[1].y = 0; centers[1].z = 0;
					diams[1] = diam1;

					double l = length1;
					int max = 2*((int)((l-40)/40));
					double dx1 = 20, 				dy1 = 0;
					double dx2 = 20+1*(l-40)/max,	dy2 = (l-40)/max;
					centers[2].x = -length1/2+dx2; centers[2].y = 0; centers[2].z = 0;
					diams[2] = diam1+dy2*2;

					p1.set(-length1/2+dx2, 0, 0);
					drawAsThinArc(p1);

					int dir = 1, segCount = 3;
					for(int cnt = 1; cnt + 2 < max; cnt += 2 )
					{
						dx1 = 20+cnt*(l-40)/max;	dy1 =  dir*(l-40)/max;
						dx2 = 20+(cnt+2)*(l-40)/max;	dy2 = -dir*(l-40)/max;
						centers[segCount][0] = -l/2+dx2; centers[segCount][1] = 0; centers[segCount][2] = 0;
						diams[segCount] = diam1+dy2*2;

						p1.set(-l/2+dx2, 0, 0);
						drawAsThinArc(p1);
						dir *= -1;
						segCount++;
					}

					centers[segCount][0] = l/2-20; centers[segCount][1] = 0; centers[segCount][2] = 0;
					diams[segCount] = diam1;
					centers[segCount+1][0] = l/2; centers[segCount+1][1] = 0; centers[segCount+1][2] = 0;
					diams[segCount+1] = diam1;

					numOfSegs = segCount+1;
					makeStraightTube(centers, diams, n, numOfSegs, true);

					delete[] centers;
					delete[] diams;
				}
			}
		}
	}
	else if( getExtInsSize(size) )
	{
		diam1 += 4 * size; diam2 += 4 * size; diam3 += 4 * size;
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1,p2;

		p1.set(-length1/2, 0, 0);
		addCircularConnector(p1);

		p2.set(length1/2, 0, 0);
		addCircularConnector(p1);

		addCenterLine(p1, p2);

		//--- if the length is less than 80 then this is one continuous tube
		if( length1 < 80 )
		{
			p1.set(-length1/2, 0, 0);
			p2.set(length1/2, 0, 0);
			FdPoint3d centers[2] = {p1,p2};
			makeVerySimpleTube(centers, diam1, n);
		}
		//--- otherwise it's more complicated :)
		else
		{
			int numOfSegs = length1 / 20;

			FdPoint3d (*centers) = new FdPoint3d[numOfSegs + 1];
			double *diams = new double[numOfSegs+1];

			centers[0].x = -length1/2; centers[0].y = 0; centers[0].z = 0;
			diams[0] = diam1;
			centers[1].x = -length1/2+20; centers[1].y = 0; centers[1].z = 0;
			diams[1] = diam1;

			double l = length1;
			int max = 2*((int)((l-40)/40));
			double dx1 = 20, 				dy1 = 0;
			double dx2 = 20+1*(l-40)/max,	dy2 = (l-40)/max;
			centers[2].x = -length1/2+dx2; centers[2].y = 0; centers[2].z = 0;
			diams[2] = diam1+dy2*2;

			p1.set(-length1/2+dx2, 0, 0);
			drawAsThinArc(p1);

			int dir = 1, segCount = 3;
			for(int cnt = 1; cnt + 2 < max; cnt += 2 )
			{
				dx1 = 20+cnt*(l-40)/max;	dy1 =  dir*(l-40)/max;
				dx2 = 20+(cnt+2)*(l-40)/max;	dy2 = -dir*(l-40)/max;
				centers[segCount][0] = -l/2+dx2; centers[segCount][1] = 0; centers[segCount][2] = 0;
				diams[segCount] = diam1+dy2*2;

				p1.set(-l/2+dx2, 0, 0);
				drawAsThinArc(p1);
				dir *= -1;
				segCount++;
			}

			centers[segCount][0] = l/2-20; centers[segCount][1] = 0; centers[segCount][2] = 0;
			diams[segCount] = diam1;
			centers[segCount+1][0] = l/2; centers[segCount+1][1] = 0; centers[segCount+1][2] = 0;
			diams[segCount+1] = diam1;

			numOfSegs = segCount+1;
			makeStraightTube(centers, diams, n, numOfSegs, true);

			delete[] centers;
			delete[] diams;

			if (true)
			{
				diam1 -= 2*size; diam2 -= 2*size; diam3 -= 2*size;

				p1.set(-length1/2, 0, 0);
				p2.set(length1/2, 0, 0);

				makeFlatRing(p1, vx, diam1, diam1 + 2*size, n);
				makeFlatRing(p2, vx, diam1, diam1 + 2*size, n);

				setPrimitiveMode(FLM3Geo::pmNormal);


						FdPoint3d p1,p2;

				p1.set(-length1/2, 0, 0);
				addCircularConnector(p1);

				p2.set(length1/2, 0, 0);
				addCircularConnector(p1);

				addCenterLine(p1, p2);

				//--- if the length is less than 80 then this is one continuous tube
				if( length1 < 80 )
				{
					p1.set(-length1/2, 0, 0);
					p2.set(length1/2, 0, 0);
					FdPoint3d centers[2] = {p1,p2};
					makeVerySimpleTube(centers, diam1, n);

				}
				//--- otherwise it's more complicated :)
				else
				{
					int numOfSegs = length1 / 20;

					FdPoint3d (*centers) = new FdPoint3d[numOfSegs + 1];
					double *diams = new double[numOfSegs+1];

					centers[0].x = -length1/2; centers[0].y = 0; centers[0].z = 0;
					diams[0] = diam1;
					centers[1].x = -length1/2+20; centers[1].y = 0; centers[1].z = 0;
					diams[1] = diam1;

					double l = length1;
					int max = 2*((int)((l-40)/40));
					double dx1 = 20, 				dy1 = 0;
					double dx2 = 20+1*(l-40)/max,	dy2 = (l-40)/max;
					centers[2].x = -length1/2+dx2; centers[2].y = 0; centers[2].z = 0;
					diams[2] = diam1+dy2*2;

					p1.set(-length1/2+dx2, 0, 0);
					drawAsThinArc(p1);

					int dir = 1, segCount = 3;
					for(int cnt = 1; cnt + 2 < max; cnt += 2 )
					{
						dx1 = 20+cnt*(l-40)/max;	dy1 =  dir*(l-40)/max;
						dx2 = 20+(cnt+2)*(l-40)/max;	dy2 = -dir*(l-40)/max;
						centers[segCount][0] = -l/2+dx2; centers[segCount][1] = 0; centers[segCount][2] = 0;
						diams[segCount] = diam1+dy2*2;

						p1.set(-l/2+dx2, 0, 0);
						drawAsThinArc(p1);
						dir *= -1;
						segCount++;
					}

					centers[segCount][0] = l/2-20; centers[segCount][1] = 0; centers[segCount][2] = 0;
					diams[segCount] = diam1;
					centers[segCount+1][0] = l/2; centers[segCount+1][1] = 0; centers[segCount+1][2] = 0;
					diams[segCount+1] = diam1;

					numOfSegs = segCount+1;
					makeStraightTube(centers, diams, n, numOfSegs, true);

					delete[] centers;
					delete[] diams;
				}
			}
		}
	}
	else
	{
		FdPoint3d p1,p2;

		p1.set(-length1/2, 0, 0);
		addCircularConnector(p1);

		p2.set(length1/2, 0, 0);
		addCircularConnector(p1);

		addCenterLine(p1, p2);

		//--- if the length is less than 80 then this is one continuous tube
		if( length1 < 80 )
		{
			p1.set(-length1/2, 0, 0);
			p2.set(length1/2, 0, 0);
			FdPoint3d centers[2] = {p1,p2};
			makeVerySimpleTube(centers, diam1, n);
		}
		//--- otherwise it's more complicated :)
		else
		{
			int numOfSegs = length1 / 20;

			FdPoint3d (*centers) = new FdPoint3d[numOfSegs + 1];
			double *diams = new double[numOfSegs+1];

			centers[0].x = -length1/2; centers[0].y = 0; centers[0].z = 0;
			diams[0] = diam1;
			centers[1].x = -length1/2+20; centers[1].y = 0; centers[1].z = 0;
			diams[1] = diam1;

			double l = length1;
			int max = 2*((int)((l-40)/40));
			double dx1 = 20, 				dy1 = 0;
			double dx2 = 20+1*(l-40)/max,	dy2 = (l-40)/max;
			centers[2].x = -length1/2+dx2; centers[2].y = 0; centers[2].z = 0;
			diams[2] = diam1+dy2*2;

			p1.set(-length1/2+dx2, 0, 0);
			drawAsThinArc(p1);

			int dir = 1, segCount = 3;
			for(int cnt = 1; cnt + 2 < max; cnt += 2 )
			{
				dx1 = 20+cnt*(l-40)/max;	dy1 =  dir*(l-40)/max;
				dx2 = 20+(cnt+2)*(l-40)/max;	dy2 = -dir*(l-40)/max;
				centers[segCount][0] = -l/2+dx2; centers[segCount][1] = 0; centers[segCount][2] = 0;
				diams[segCount] = diam1+dy2*2;

				p1.set(-l/2+dx2, 0, 0);
				drawAsThinArc(p1);
				dir *= -1;
				segCount++;
			}

			centers[segCount][0] = l/2-20; centers[segCount][1] = 0; centers[segCount][2] = 0;
			diams[segCount] = diam1;
			centers[segCount+1][0] = l/2; centers[segCount+1][1] = 0; centers[segCount+1][2] = 0;
			diams[segCount+1] = diam1;

			numOfSegs = segCount+1;
			makeStraightTube(centers, diams, n, numOfSegs, true);

			delete[] centers;
			delete[] diams;
		}
	}
}


void GLEAccesories::makeCH1(double a, double b, double diam1, double l1, double l2, double s1cp, double s2cp, int n)
{
	// make plane with circular hole (left)
	FdPoint3d p1,p2;
	p1.set(-l2/2, 0, 0);
	double heightWidth2[2] = {b, a};
	double tubeParams[3] = {diam1, diam1, 0};
	makeRectToTubeTransition(p1, vx, vy, heightWidth2, p1, tubeParams, n);

	// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
	p1.set(-l2/2, 0, 0); p2.set(-l1/2, 0, 0);
	makeVerySimpleTube(p1, p2, diam1, n);

	// make plane with circular hole (right)
	p1.set(l2/2, 0, 0);
	makeRectToTubeTransition(p1, vx, vy, heightWidth2, p1, tubeParams, n);

	// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
	p2.set(l1/2, 0, 0);
	makeVerySimpleTube(p1, p2, diam1, n);

	// make the box
	p1.set(-l2/2, 0, 0); p2.set(l2/2, 0, 0);
	FdPoint3d centralPoints[2] = {p1, p2};
	double tabWidth[2] = {a, a};
	double tabHeight[2]= {b, b};
	makeBox(1,centralPoints,tabWidth,tabHeight,false);

	p1.set(-l1/2, 0, 0);
	addCircularConnector(p1);

	p1.set(l1/2, 0, 0);
	addCircularConnector(p1);

	p1.set(-l2/2, 0, 0);
	drawAsThinArc(p1);

	p1.set(l2/2, 0, 0);
	drawAsThinArc(p1);

	// add approriate symbol to all four sides
	s1cp = 0.8; s2cp = 0.8;  // proportions for circle sizes
	double c1_diam, c2_diam, size;

	// scaling diameters
	if (b >= l2) c1_diam = l2*s1cp;
	else c1_diam = b*s1cp;
	if (a >= l2) c2_diam = l2*s2cp;
	else c2_diam = a*s2cp;

	if( !getExtInsSize(size) )  // only when there is no insulation
	{
		// drawing symbols
		p1.set(0, 0, a/2);
		makeCircleWithPlus(p1, vz, vy, c1_diam);

		p1.set(0, b/2, 0);
		makeCircleWithPlus(p1, vy, -vz, c2_diam);

		p1.set(0, 0, -a/2);
		makeCircleWithPlus(p1, -vz, -vy, c1_diam);

		p1.set(0, -b/2, 0);
		makeCircleWithPlus(p1, -vy, vz, c2_diam);
	}

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		diam1 += 2*size; a += 2 * size; b += 2 * size;
		/* l1 -= size; */ l2 -= size;

		FdPoint3d p1, p2;
		p1.set(-l2/2-size, 0, 0);
		double heightWidth2[2] = {b, a};
		double tubeParams[3] = {diam1, diam1, 0};
		makeRectToTubeTransition(p1, vx, vy, heightWidth2, p1, tubeParams, n);

		// make connecting tube (this is not drawn by the rect to circ transition because of shading issues)
		p1.set(-l2/2, 0, 0); p2.set(-l1/2, 0, 0);
		makeVerySimpleTube(p1, p2, diam1, n);

		makeFlatRing(p2, vx, diam1, diam1 -2*size, n);

		// make plane with circular hole (right)
		p1.set(l2/2+size, 0, 0);
		makeRectToTubeTransition(p1,vx, vy, heightWidth2, p1, tubeParams, n);

		// make connecting tube (this is not drawn by makeRectToTubeTransition() because of shading issues)
		p1.set(l2/2, 0, 0); p2.set(l1/2, 0, 0);
		makeVerySimpleTube(p1, p2, diam1, n);

		makeFlatRing(p2, vx, diam1, diam1 -2*size, n);

		// make the box
		p1.set(-l2/2-size, 0, 0); p2.set(l2/2+size, 0, 0);
		FdPoint3d centralPoints[2] = {p1, p2};
		double tabHeight[2]= {b, b};
		double tabWidth[2] = {a, a};
		makeBox(1,centralPoints,tabWidth,tabHeight,false);

		// drawing symbols
		p1.set(0, 0, a/2);
		makeCircleWithPlus(p1, vz, vy, c1_diam);

		p1.set(0, b/2, 0);
		makeCircleWithPlus(p1, vy, -vz, c2_diam);

		p1.set(0, 0, -a/2);
		makeCircleWithPlus(p1, -vz, -vy, c1_diam);

		p1.set(0, -b/2, 0);
		makeCircleWithPlus(p1, -vy, vz, c2_diam);
	}
}

void GLEAccesories::makeCH2(double diam1, double l1, double s1cp, double s2cp, double a, double b, double e, int n)
{
	// additional variables
	double w;  // lenght from top of heater to tube
	w = (diam1/2+e) - sqrt(diam1*diam1-a*a)/2;

	// start points
	FdPoint3d p1(-l1/2, 0, 0), p2(l1/2, 0, 0);  // center points for tube
	FdPoint3d p3(0, (diam1/2+e-0.01), 0), p4(0, (diam1/2+e), 0);  // center points for heater
	FdPoint3d p5(0, w/2 + sqrt(diam1*diam1-a*a)/2, a/2), p6(0, w/2 + sqrt(diam1*diam1-a*a)/2, -a/2);  // center points for side symbols on heater


	// main tube
	double mainTubeData[3] = {diam1, diam1, l1};
	double ductPosition[2] = {l1/2, 0};
	double ductParam[3] = {b, a, diam1/2+e};

	// make intersected duct and tube
	makeRectToTubeIntersection(p1, vx, -vz, mainTubeData, ductPosition, ductParam, n);

	// added by LS
	FdPoint3d FDcenterPoints[2] = {p1, p2};
	makeSimpleTube(FDcenterPoints, diam1-0.5, diam1-0.5, 40);

	// heater cap
	FdPoint3d centralPoints[2] = {p3,p4};
	double tabWidth[2] = {a,a};
	double tabHeight[2]= {b,b};

	bool sides[4] = {true, true, true, true};
	bool connectors[2] = {false, false};

	makeBox(1, centralPoints, tabWidth, tabHeight, sides, connectors, false, true);

	// connectors
	addCircularConnector(p1);
	addCircularConnector(p2);

	// add approriate symbol to heater
	s1cp = 0.8;  s2cp = 0.8;  // proportions for circle sizes
	double c1_diam, c2_diam;

	// scaling diameters
	if (b >= a) c1_diam = a*s1cp;
	else c1_diam = b*s1cp;

	if (b >= w) c2_diam = w*s2cp;
	else c2_diam = b*s1cp;

	makeCircleWithPlus(p4, vy, vz, c1_diam);
	makeCircleWithPlus(p5, vz, vy, c2_diam);
	makeCircleWithPlus(p6, -vz, vy, c2_diam);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		diam1 += 2*size;

		// main tube
		double insTubeData[3] = {diam1, diam1, l1};
		double insDuctPosition[2] = {l1/2, 0};
		double insDuctParam[3] = {b-0.01, a-0.01, diam1/2};

		// make intersected duct and tube
		makeRectToTubeIntersection(p1, vx, -vz, insTubeData, insDuctPosition, insDuctParam, n);

		// make closing rings on the ond of the tube
		makeFlatRing(p1, vx, diam1, diam1 -2*size, n);
		makeFlatRing(p2, vx, diam1, diam1 -2*size, n);
	}
}

void GLEAccesories :: makeCRD1(double diam1, double length1, double length2, double length3, double length4, double length5, double height, double width, int n)
{
	FdPoint3d p1, p2;
	p1.set( length1 / 2 + length5 - length4, 0, 0);
	p2.set( length1 / 2           - length4, 0, 0);
	makeVerySimpleTube(p1, p2, diam1, n);

	p1.set(-length1 / 2,                               0, 0);
	p2.set( length1 / 2 - length2 - length3 - length4, 0, 0);
	makeVerySimpleTube(p1, p2, diam1, n);

	p1.set( length1 / 2 - length3 - length4, 0, 0);
	double heightWidth2[2] = { width, height };
	p2.set( length1 / 2           - length4, 0, 0);
	double tubeParams[3] = { diam1, diam1, 0 };
	makeRectToTubeTransition(p1,vx,vy, heightWidth2, p2, tubeParams, n);

	p1.x = length1 / 2 - length2 - length3 - length4;
	p2.x = length1 / 2 - length2 - length3 - length4;
	makeRectToTubeTransition(p1, vx, vy, heightWidth2, p2, tubeParams, n);

	p1.set( length1 / 2           - length3 - length4, 0, 0);
	p2.set( length1 / 2 - length2 - length3 - length4, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabHeight[2] = { width, width };
	double tabWidth[2]  = { height, height };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	p1.set(-length1 / 2, 0, 0);
	addCircularConnector(p1);

	p1.set( length1 / 2 + length5 - length4, 0, 0);
	addCircularConnector(p1);

	p1.set( length1 / 2 - length2 - length3 - length4, 0, 0);
	drawAsThinArc(p1);

	p1.set( length1 / 2 - length4, 0, 0);
	drawAsThinArc(p1);

	p1.set( length1 / 2           - length4, diam1 / 2, 0);
	p2.set( length1 / 2 - length3 - length4, width / 2, height / 2);
	drawAsThinLine(p1, p2);

	p1.set( length1 / 2           - length4, 0,         diam1 / 2);
	p2.set( length1 / 2 - length3 - length4, width / 2, height / 2);
	drawAsThinLine(p1, p2);

	p1.set( length1 / 2           - length4, -diam1 / 2, 0);
	p2.set( length1 / 2 - length3 - length4, -width / 2, height / 2);
	drawAsThinLine(p1, p2);

	p1.set( length1 / 2           - length4,  0,         diam1 / 2);
	p2.set( length1 / 2 - length3 - length4, -width / 2, height / 2);
	drawAsThinLine(p1, p2);

	p1.set( length1 / 2           - length4, -diam1 / 2,  0);
	p2.set( length1 / 2 - length3 - length4, -width / 2, -height / 2);
	drawAsThinLine(p1, p2);

	p1.set( length1 / 2           - length4,  0,         -diam1 / 2);
	p2.set( length1 / 2 - length3 - length4, -width / 2, -height / 2);
	drawAsThinLine(p1, p2);

	p1.set( length1 / 2           - length4, diam1 / 2,  0);
	p2.set( length1 / 2 - length3 - length4, width / 2, -height / 2);
	drawAsThinLine(p1, p2);

	p1.set( length1 / 2           - length4, 0,         -diam1 / 2);
	p2.set( length1 / 2 - length3 - length4, width / 2, -height / 2);
	drawAsThinLine(p1, p2);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copylength1 = length1, copylength2 = length2, copylength3 = length3,
	       copylength4 = length4, copyheight = height, copywidth = width;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		diam1 += 2 * size;  height += 2 * size;  width += 2 * size;
		length2 += 2 * size;  length4 -= size;

		FdPoint3d p1, p2;
		p1.set( length1 / 2           - length4,        0, 0);
		p2.set( length1 / 2 + length5 - length4 - size, 0, 0);
		makeVerySimpleTube(p1, p2, diam1, n);

		makeFlatRing(p2, vx, diam1, diam1 - 2 * size, n);

		p1.set(-length1 / 2,                               0, 0);
		p2.set( length1 / 2 - length2 - length3 - length4, 0, 0);
		makeVerySimpleTube(p1, p2, diam1, n);

		makeFlatRing(p1, vx, diam1, diam1 - 2 * size, n);

		p1.set( length1 / 2 - length3 - length4, 0, 0);
		double heightWidth2[2] = { width, height };
		p2.set( length1 / 2           - length4, 0, 0);
		double tubeParams[3] = { diam1, diam1, 0 };
		makeRectToTubeTransition(p1, vx, vy, heightWidth2, p2, tubeParams, n);

		p1.x = length1 / 2 - length2 - length3 - length4;
		p2.x = length1 / 2 - length2 - length3 - length4;
		makeRectToTubeTransition(p1, vx, vy, heightWidth2, p2, tubeParams, n);

		p1.set( length1 / 2           - length3 - length4, 0, 0);
		p2.set( length1 / 2 - length2 - length3 - length4, 0, 0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		double tabHeight[2] = { width, width };
		double tabWidth[2]  = { height, height };
		makeBox(1, centralPoints, tabWidth, tabHeight, false);
	}

	/**********************************Recover variables*******************************/
	diam1 = copydiam1;  length1 = copylength1;  length2 = copylength2;  length3 = copylength3;
	length4 = copylength4;  height = copyheight;  width = copywidth;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		diam1 -= 2 * size;  height -= 2 * size;  width -= 2 * size;
		length2 -= 2 * size;  length4 += size;

		FdPoint3d p1, p2;
		p1.set(-length1 / 2,                            0, 0);
		p2.set( length1 / 2 + length5 - length4 + size, 0, 0);
		makeVerySimpleTube(p1, p2, diam1, n);
		makeFlatRing(p2, vx, diam1, diam1 + 2 * size, n);
		makeFlatRing(p1, vx, diam1, diam1 + 2 * size, n);

		// FdPoint3d p1, p2;
		// p1.set( length1 / 2 - length4, 0, 0);
		// p2.set( length1 / 2,           0, 0);
		// makeVerySimpleTube(p1,p2, diam1, n);

		// p1.set(-length1 / 2,                               0, 0);
		// p2.set( length1 / 2 - length2 - length3 - length4, 0, 0);
		// makeVerySimpleTube(p1, p2, diam1, n);

		// p1.set( length1 / 2 - length3 - length4, 0, 0);
		// double heightWidth2[2] = { width, height };
		// p2.set( length1 / 2           - length4, 0, 0);
		// double tubeParams[3] = { diam1, diam1, 0 };
		// makeRectToTubeTransition(p1, vx, vy, heightWidth2, p2, tubeParams, n);

		// p1.x = length1 / 2 - length2 - length3 - length4;
		// p2.x = length1 / 2 - length2 - length3 - length4;
		// makeRectToTubeTransition(p1, vx, vy, heightWidth2, p2, tubeParams, n);

		// p1.set( length1 / 2           - length3 - length4, 0, 0);
		// p2.set( length1 / 2 - length2 - length3 - length4, 0, 0);
		// FdPoint3d centralPoints[2] = { p1, p2 };
		// double tabHeight[2] = { width, width };
		// double tabWidth[2]  = { height, height };
		// makeBox(1, centralPoints, tabWidth, tabHeight, false);
	}
}

void GLEAccesories::makeCS1(double diam1, double diam2, double length1, double length2, int n)
{
	//--- one continuous tube
	FdPoint3d p1,p2,p3,p4;
	p1.set(-length1/2, 0, 0); p2.set(-length1/2+length2, 0, 0);
	p3.set(length1/2-length2, 0, 0); p4.set(length1/2, 0, 0);
	FdPoint3d centerPoints[6] = {p1,p2,p2,p3,p3,p4};
	double diams[6] = {diam1, diam1, diam2, diam2, diam1, diam1};
	makeStraightTube(centerPoints, diams, n, 5, true);

	//--- add hlr info
	addCircularConnector(p1);
	addCircularConnector(p4);
	drawAsThinArc(p2, diam1/2);
	drawAsThinArc(p3, diam1/2);
	addCenterLine(p1, p4);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		diam1 += 2*size; diam2 += 2*size; length2 -= 2 * size;

		FdPoint3d p1,p2,p3,p4;
		p1.set(-length1/2, 0, 0); p2.set(-length1/2+length2, 0, 0);
		p3.set(length1/2-length2, 0, 0); p4.set(length1/2, 0, 0);
		FdPoint3d centerPoints[8] = {p1, p1, p2, p2, p3, p3, p4, p4};
		double diams[8] = {diam1 - 2*size, diam1, diam1, diam2, diam2, diam1, diam1, diam1 - 2*size};
		makeStraightTube(centerPoints, diams, n, 7, true);
	}
}

void GLEAccesories :: makeRD1(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2, 0, 0),
	          p2( l / 2, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	// add approriate symbol to all four sides
	p1.set(0, 0, b / 2.0);
	makeDampers(p1, vz, vy, a, 5);

	p1.set(0, a / 2.0, 0);
	makeDampers(p1, vy, -vz, b, 5);

	p1.set(0, 0, -b / 2.0);
	makeDampers(p1, -vz, -vy, a, 5);

	p1.set(0, -a / 2.0, 0);
	makeDampers(p1, -vy, vz, b, 5);

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

void GLEAccesories :: makeRF1(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2, 0, 0),
	          p2( l / 2, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	addSymbolicFlangeRect(p1, vx, vy, a, b);
	addSymbolicFlangeRect(p1, vx, vy, a, b);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	// add approriate symbol to all four sides
	double symbolSize1, symbolSize2;
	if( l <= a )
		symbolSize1 = l / 4;
	else
		symbolSize1 = a / 4;
	if( l <= b )
		symbolSize2 = l / 4;
	else
		symbolSize2 = b / 4;

	p1.set(0, 0, b / 2);
	makeReversedSigma(p1, vz, vy, a, symbolSize1);

	p1.set(0, a / 2, 0);
	makeReversedSigma(p1, vy, -vz, b, symbolSize2);

	p1.set(0, 0, -b / 2);
	makeReversedSigma(p1, -vz, -vy, a, symbolSize1);

	p1.set(0, -a / 2, 0);
	makeReversedSigma(p1, -vy, vz, b, symbolSize2);

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

void GLEAccesories :: makeRFC(double a, double b, double l, double flange_1, double flange_2)
{
	/**********************************Int Insulation*******************************/
	double size;
	if( getIntInsSize(size) )
	{
		// one cute box
		double l1 = l - 2 * fo;
		int nr = l1 / fo;

		FdVector3d (*vectorsD) = new FdVector3d[nr + 4];
		FdPoint3d (*centralPointsD) = new FdPoint3d[nr + 4];
		for( int i = 0; i < nr + 4; i++ )
		{
			vectorsD[i][0] = 1;
			vectorsD[i][1] = 0;
			vectorsD[i][2] = 0;
		};

		centralPointsD[0][0] = -l / 2.0;
		centralPointsD[0][1] = 0;
		centralPointsD[0][2] = 0;
		centralPointsD[1][0] = -l / 2.0 + fo;
		centralPointsD[1][1] = 0;
		centralPointsD[1][2] = 0;
		for( int i = 2; i < nr + 2; i++ )
		{
			centralPointsD[i][0] = -l / 2.0 + fo * i;
			centralPointsD[i][1] = 0;
			centralPointsD[i][2] = 0;
		}
		centralPointsD[nr + 2][0] = l / 2.0 - fo;
		centralPointsD[nr + 2][1] = 0;
		centralPointsD[nr + 2][2] = 0;
		centralPointsD[nr + 3][0] = l / 2.0;
		centralPointsD[nr + 3][1] = 0;
		centralPointsD[nr + 3][2] = 0;

		double *tabWidth  = new double[nr + 4];
		double *tabHeight = new double[nr + 4];
		bool *sides = new bool[(nr + 4) * 4];

		tabWidth[0] = b;
		tabHeight[0] = a;
		tabWidth[1] = b;
		tabHeight[1] = a;

		for( int i = 2; i < nr + 2; i++ )
		{
			if( (i%2) == 0 )
			{
				tabWidth[i] = b + fo;
				tabHeight[i] = a + fo;
			}
			else
			{
				tabWidth[i] = b - fo;
				tabHeight[i] = a - fo;
			}

			drawRectAsThinLines(centralPointsD[i], vx, vy, tabHeight[i], tabWidth[i]);
		}

		tabWidth[nr + 2] = b;
		tabHeight[nr + 2] = a;
		tabWidth[nr + 3] = b;
		tabHeight[nr + 3] = a;

		for( int i = 0; i < (nr + 3) * 4; i++ )
			sides[i] = true;
		bool con[2] = { false, false };
		makeBox(nr + 3, centralPointsD, vectorsD, tabWidth, tabHeight, sides, con, false, false);

		FdPoint3d p1, p2;
		p1.set(-l / 2, 0, 0);
		p2.set( l / 2, 0, 0);
		addRectangularConnector(p1, vx, vz, b + 2 * flange_1, a + 2 * flange_1);
		addRectangularConnector(p2, vx, vz, b + 2 * flange_2, a + 2 * flange_2);
		makeRectangularFlange(p1, vx, vz, b, a, flange_1);
		makeRectangularFlange(p2, vx, vz, b, a, flange_2);

		// free the memory
		delete[] vectorsD;
		delete[] centralPointsD;
		delete[] tabWidth;
		delete[] tabHeight;


		if( true )
		{
			setPrimitiveMode(FLM3Geo::pmIntInsulation);

			a -= 2 * size;
			b -= 2 * size;

			// one cute box
			double l1 = l - 2 * fo;
			int nr = l1 / fo;

			FdVector3d (*vectorsD) = new FdVector3d[nr + 4];
			FdVector3d (*upVectorsD) = new FdVector3d[nr + 4];
			FdPoint3d (*centralPointsD) = new FdPoint3d[nr + 4];
			for( int i = 0; i < nr + 4; i++ )
			{
				vectorsD[i][0] = 1;
				vectorsD[i][1] = 0;
				vectorsD[i][2] = 0;

				upVectorsD[i][0] = 0;
				upVectorsD[i][1] = 0;
				upVectorsD[i][2] = 1;
			};

			centralPointsD[0][0] = -l / 2.0;
			centralPointsD[0][1] = 0;
			centralPointsD[0][2] = 0;
			centralPointsD[1][0] = -l / 2.0 + fo;
			centralPointsD[1][1] = 0;
			centralPointsD[1][2] = 0;
			for( int i = 2; i < nr + 2; i++ )
			{
				centralPointsD[i][0] = -l / 2.0 + fo * i;
				centralPointsD[i][1] = 0;
				centralPointsD[i][2] = 0;
			}
			centralPointsD[nr + 2][0] = l / 2.0 - fo;
			centralPointsD[nr + 2][1] = 0;
			centralPointsD[nr + 2][2] = 0;
			centralPointsD[nr + 3][0] = l / 2.0;
			centralPointsD[nr + 3][1] = 0;
			centralPointsD[nr + 3][2] = 0;

			double *tabWidth  = new double[nr + 4];
			double *tabHeight = new double[nr + 4];
			bool *sides = new bool[(nr + 4) * 4];

			tabWidth[0] = b;
			tabHeight[0] = a;
			tabWidth[1] = b;
			tabHeight[1] = a;

			for( int i = 2; i < nr + 2; i++ )
			{
				if( (i%2) == 0 )
				{
					tabWidth[i] = b + fo;
					tabHeight[i] = a + fo;
				}
				else
				{
					tabWidth[i] = b - fo;
					tabHeight[i] = a - fo;
				}

				drawRectAsThinLines(centralPointsD[i], vx, vy, tabHeight[i], tabWidth[i]);
			}

			tabWidth[nr + 2] = b;
			tabHeight[nr + 2] = a;
			tabWidth[nr + 3] = b;
			tabHeight[nr + 3] = a;

			for( int i = 0; i < (nr + 3) * 4; i++ )
				sides[i] = true;
			makeBox(nr + 3, centralPointsD, vectorsD, upVectorsD, tabHeight, tabWidth, sides, false, false, 0, 0, size);

			// free the memory
			delete[] vectorsD;
			delete[] upVectorsD;
			delete[] centralPointsD;
			delete[] tabWidth;
			delete[] tabHeight;
		}
	}
	else if( getExtInsSize(size) )
	{
		a += 2 * size;
		b += 2 * size;
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		// one cute box
		double l1 = l - 2 * fo;
		int nr = l1 / fo;

		FdVector3d (*vectorsD) = new FdVector3d[nr + 4];
		FdVector3d (*upVectorsD) = new FdVector3d[nr + 4];
		FdPoint3d (*centralPointsD) = new FdPoint3d[nr + 4];
		for( int i = 0; i < nr + 4; i++ )
		{
			vectorsD[i][0] = 1;
			vectorsD[i][1] = 0;
			vectorsD[i][2] = 0;

			upVectorsD[i][0] = 0;
			upVectorsD[i][1] = 0;
			upVectorsD[i][2] = 1;
		};

		centralPointsD[0][0] = -l / 2.0;
		centralPointsD[0][1] = 0;
		centralPointsD[0][2] = 0;
		centralPointsD[1][0] = -l / 2.0 + fo;
		centralPointsD[1][1] = 0;
		centralPointsD[1][2] = 0;
		for( int i = 2; i < nr + 2; i++ )
		{
			centralPointsD[i][0] = -l / 2.0 + fo * i;
			centralPointsD[i][1] = 0;
			centralPointsD[i][2] = 0;
		}
		centralPointsD[nr + 2][0] = l / 2.0 - fo;
		centralPointsD[nr + 2][1] = 0;
		centralPointsD[nr + 2][2] = 0;
		centralPointsD[nr + 3][0] = l / 2.0;
		centralPointsD[nr + 3][1] = 0;
		centralPointsD[nr + 3][2] = 0;

		double *tabWidth  = new double[nr + 4];
		double *tabHeight = new double[nr + 4];
		bool *sides = new bool[(nr + 4) * 4];

		tabWidth[0] = b;
		tabHeight[0] = a;
		tabWidth[1] = b;
		tabHeight[1] = a;

		for( int i = 2; i < nr + 2; i++ )
		{
			if( (i%2) == 0 )
			{
				tabWidth[i] = b + fo;
				tabHeight[i] = a + fo;
			}
			else
			{
				tabWidth[i] = b - fo;
				tabHeight[i] = a - fo;
			}

			drawRectAsThinLines(centralPointsD[i], vx, vy, tabHeight[i], tabWidth[i]);
		}

		tabWidth[nr + 2] = b;
		tabHeight[nr + 2] = a;
		tabWidth[nr + 3] = b;
		tabHeight[nr + 3] = a;

		for( int i = 0; i < (nr + 3) * 4; i++ )
			sides[i] = true;
		makeBox(nr + 3, centralPointsD, vectorsD, upVectorsD, tabHeight, tabWidth, sides, false, false, (size > flange_1) ? 0 : 5, (size > flange_2) ? 0 : 5, (flange_1 > flange_2) ? (flange_2 - size) : (flange_1 - size));

		// free the memory
		delete[] vectorsD;
		delete[] upVectorsD;
		delete[] centralPointsD;
		delete[] tabWidth;
		delete[] tabHeight;


		if( true )
		{
			setPrimitiveMode(FLM3Geo::pmNormal);

			a -= 2 * size;
			b -= 2 * size;

			FdPoint3d p1, p2;
			p1.set(-l / 2, 0, 0);
			p2.set( l / 2, 0, 0);
			// makeConnector(p1, vx, vz, b, a, size);
			// makeConnector(p2, vx, vz, b, a, size);
			makeRectangularFlange(p1, vx, vz, b, a, flange_1);
			makeRectangularFlange(p2, vx, vz, b, a, flange_2);

			// one cute box
			double l1 = l - 2 * fo;
			int nr = l1 / fo;

			FdVector3d (*vectorsD) = new FdVector3d[nr + 4];
			FdPoint3d (*centralPointsD) = new FdPoint3d[nr + 4];
			for( int i = 0; i < nr + 4; i++ )
			{
				vectorsD[i][0] = 1;
				vectorsD[i][1] = 0;
				vectorsD[i][2] = 0;
			};

			centralPointsD[0][0]= -l / 2.0;
			centralPointsD[0][1]= 0;
			centralPointsD[0][2]= 0;
			centralPointsD[1][0]= -l / 2.0 + fo;
			centralPointsD[1][1]= 0;
			centralPointsD[1][2]= 0;
			for( int i = 2; i < nr + 2; i++ )
			{
				centralPointsD[i][0] = -l / 2.0 + fo * i;
				centralPointsD[i][1] = 0;
				centralPointsD[i][2] = 0;
			}
			centralPointsD[nr + 2][0]= l / 2.0 - fo;
			centralPointsD[nr + 2][1]= 0;
			centralPointsD[nr + 2][2]= 0;
			centralPointsD[nr + 3][0]= l / 2.0;
			centralPointsD[nr + 3][1]= 0;
			centralPointsD[nr + 3][2]= 0;

			double *tabWidth  = new double[nr + 4];
			double *tabHeight = new double[nr + 4];
			bool *sides = new bool[(nr + 4) * 4];

			tabWidth[0] = b;
			tabHeight[0] = a;
			tabWidth[1] = b;
			tabHeight[1] = a;

			for( int i = 2; i < nr + 2; i++ )
			{
				if( (i%2) == 0 )
				{
					tabWidth[i] = b + fo;
					tabHeight[i] = a + fo;
				}
				else
				{
					tabWidth[i] = b - fo;
					tabHeight[i] = a - fo;
				}

				drawRectAsThinLines(centralPointsD[i], vx, vy, tabHeight[i], tabWidth[i]);
			}

			tabWidth[nr + 2] = b;
			tabHeight[nr + 2] = a;
			tabWidth[nr + 3] = b;
			tabHeight[nr + 3] = a;

			for( int i = 0; i < (nr + 3) * 4; i++ )
				sides[i] = true;
			bool con[2] = { false, false };
			makeBox(nr + 3, centralPointsD, vectorsD, tabWidth, tabHeight, sides, con, false, false);

			p1.set(-l / 2, 0, 0);
			p2.set( l / 2, 0, 0);
			addRectangularConnector(p1, vx, vz, b + 2 * flange_1, a + 2 * flange_1);
			addRectangularConnector(p2, vx, vz, b + 2 * flange_2, a + 2 * flange_2);
			makeRectangularFlange(p1, vx, vz, b, a, flange_1);
			makeRectangularFlange(p2, vx, vz, b, a, flange_2);

			// free the memory
			delete[] vectorsD;
			delete[] centralPointsD;
			delete[] tabWidth;
			delete[] tabHeight;
		}
	}
	else
	{
		// one cute box
		double l1 = l - 2 * fo;
		int nr = l1 / fo;

		FdVector3d (*vectorsD) = new FdVector3d[nr + 4];
		FdPoint3d (*centralPointsD) = new FdPoint3d[nr + 4];
		for( int i = 0; i < nr + 4; i++ )
		{
			vectorsD[i][0] = 1;
			vectorsD[i][1] = 0;
			vectorsD[i][2] = 0;
		};

		centralPointsD[0][0]= -l / 2.0;
		centralPointsD[0][1]= 0;
		centralPointsD[0][2]= 0;
		centralPointsD[1][0]= -l / 2.0 + fo;
		centralPointsD[1][1]= 0;
		centralPointsD[1][2]= 0;
		for( int i = 2; i < nr + 2; i++ )
		{
			centralPointsD[i][0] = -l / 2.0 + fo * i;
			centralPointsD[i][1] = 0;
			centralPointsD[i][2] = 0;
		}
		centralPointsD[nr + 2][0]= l / 2.0 - fo;
		centralPointsD[nr + 2][1]= 0;
		centralPointsD[nr + 2][2]= 0;
		centralPointsD[nr + 3][0]= l / 2.0;
		centralPointsD[nr + 3][1]= 0;
		centralPointsD[nr + 3][2]= 0;

		double *tabWidth  = new double[nr + 4];
		double *tabHeight = new double[nr + 4];
		bool *sides = new bool[(nr + 4) * 4];

		tabWidth[0] = b;
		tabHeight[0] = a;
		tabWidth[1] = b;
		tabHeight[1] = a;

		for( int i = 2; i < nr + 2; i++ )
		{
			if( (i%2) == 0 )
			{
				tabWidth[i] = b + fo;
				tabHeight[i] = a + fo;
			}
			else
			{
				tabWidth[i] = b - fo;
				tabHeight[i] = a - fo;
			}

			drawRectAsThinLines(centralPointsD[i], vx, vy, tabHeight[i], tabWidth[i]);
		}

		tabWidth[nr + 2] = b;
		tabHeight[nr + 2] = a;
		tabWidth[nr + 3] = b;
		tabHeight[nr + 3] = a;

		for( int i = 0; i < (nr + 3) * 4; i++ )
			sides[i] = true;
		bool con[2] = { false, false };
		makeBox(nr + 3, centralPointsD, vectorsD, tabWidth, tabHeight, sides, con, false, false);

		FdPoint3d p1, p2;
		p1.set(-l / 2, 0, 0);
		p2.set( l / 2, 0, 0);
		addRectangularConnector(p1, vx, vz, b + 2 * flange_1, a + 2 * flange_1);
		addRectangularConnector(p2, vx, vz, b + 2 * flange_2, a + 2 * flange_2);
		makeRectangularFlange(p1, vx, vz, b, a, flange_1);
		makeRectangularFlange(p2, vx, vz, b, a, flange_2);

		// free the memory
		delete[] vectorsD;
		delete[] centralPointsD;
		delete[] tabWidth;
		delete[] tabHeight;
	}
}

void GLEAccesories :: makeRH1(double a, double b, double l, double s1cp, double s2cp, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2, 0, 0),
	          p2( l / 2, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { a, a };
	double tabHeight[2] = { b, b };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, b + 2 * flange_1, a + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, b + 2 * flange_2, a + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, b, a, flange_1);
	makeRectangularFlange(p2, vx, vy, b, a, flange_2);

	// add approriate symbol to all four sides
	s1cp = 0.8;  s2cp = 0.8;  // proportions for circle sizes
	double c1_diam, c2_diam, size;

	// scaling diameters
	if( b >= l )  c1_diam = l * s1cp;
	else          c1_diam = b * s1cp;
	if( a >= l )  c2_diam = l * s2cp;
	else          c2_diam = a * s2cp;

	// drawing symbols
	if( !getExtInsSize(size) )
	{
		p1.set(0, 0, a / 2);
		makeCircleWithPlus(p1, vz, vy, c1_diam);

		p1.set(0, b / 2, 0);
		makeCircleWithPlus(p1, vy, -vz, c2_diam);

		p1.set(0, 0, -a / 2);
		makeCircleWithPlus(p1, -vz, -vy, c1_diam);

		p1.set(0, -b / 2, 0);
		makeCircleWithPlus(p1, -vy, vz, c2_diam);
	}

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1(-l / 2, 0, 0),
		          p2( l / 2, 0, 0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabWidth[2] = { a + 2 * size, a + 2 * size };
		double tabHeight[2] = { b + 2 * size, b + 2 * size };
		bool sides[4] = { true, true, true, true };
		makeBox(1, centralPoints, v, upv, tabWidth, tabHeight, sides, false, false, (size > flange_1) ? 0 : 5, (size > flange_2) ? 0 : 5, (flange_1 > flange_2) ? (flange_2 - size) : (flange_1 - size));

		// drawing symbols
		p1.set(0, 0, a / 2 + size);
		makeCircleWithPlus(p1, vz, vy, c1_diam);

		p1.set(0, b / 2 + size, 0);
		makeCircleWithPlus(p1, vy, -vz, c2_diam);

		p1.set(0, 0, -a / 2 - size);
		makeCircleWithPlus(p1, -vz, -vy, c1_diam);

		p1.set(0, -b / 2 - size, 0);
		makeCircleWithPlus(p1, -vy, vz, c2_diam);
	}
}

void GLEAccesories :: makeRH2(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2, 0, 0),
	          p2( l / 2, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	addRectangularConnector(p1, vx, vy, a + 2 * flange_1, b + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, a + 2 * flange_2, b + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, a, b, flange_1);
	makeRectangularFlange(p2, vx, vy, a, b, flange_2);

	// add approriate symbol to all four sides
	double symbolSize1, symbolSize2;
	if( l < a )
		symbolSize1 = l / 2;
	else
		symbolSize1 = a / 2;
	if( l < b )
		symbolSize2 = l / 2;
	else
		symbolSize2 = b / 2;

	p1.set(0, 0, b / 2);
	makeCircleWithMinus(p1, vz, vy, symbolSize1);

	p1.set(0, a / 2, 0);
	makeCircleWithMinus(p1, vy, -vz, symbolSize2);

	p1.set(0, 0, -b / 2);
	makeCircleWithMinus(p1, -vz, -vy, symbolSize1);

	p1.set(0, -a / 2, 0);
	makeCircleWithMinus(p1, -vy, vz, symbolSize2);

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

void GLEAccesories :: makeRRD1(double a, double b, double A, double B, double l, double l2, double l3, double l4, double flange_1, double flange_2)
{
	FdPoint3d p1, p2, p3, p4, p5;
	p1.set( l / 2.0,                0, 0);
	p2.set( l / 2.0 - l2,           0, 0);
	p3.set( l / 2.0 - l2 - l3,      0, 0);
	p4.set( l / 2.0 - l2 - l3 - l4, 0, 0);
	p5.set(-l / 2.0,                0, 0);
	FdPoint3d centralPointsD[6] = { p1, p2, p3, p4, p4, p5 };
	FdVector3d vectorsD[6] = { vx, vx, vx, vx, vx, vx };
	FdVector3d upVectorsD[6] = { vz, vz, vz, vz, vz, vz };
	double tabWidth[6] = { b, b, B, B, b, b };
	double tabHeight[6] = { a, a, A, A, a, a };
	bool sides[24];
	for( int i = 0; i < 24; i++ )
		sides[i] = true;
	makeBox(5, centralPointsD, vectorsD, upVectorsD, tabWidth, tabHeight, sides, false, false, 5, 5, CONNECTOR_WIDTH);

	p1.set( l / 2, 0, 0);
	p2.set(-l / 2, 0, 0);
	// FdPoint3d centralPoints[2] = { p1, p2 };
	// double tabWidth2[2] = { a, a };
	// double tabHeight2[2] = { b, b };
	// bool con[2] = { false, false };  // true means draw, false means not to. {first connector, second connector}
	// makeBox(1, centralPoints, tabWidth2, tabHeight2, sides, con, false, false);

	addRectangularConnector(p1, -vx, vz, a + 2 * flange_2, b + 2 * flange_2);
	addRectangularConnector(p2, -vx, vz, a + 2 * flange_1, b + 2 * flange_1);
	makeRectangularFlange(p1, -vx, vz, a, b, flange_2);
	makeRectangularFlange(p2, -vx, vz, a, b, flange_1);

	p1.set( l / 2 + l2, 0, 0);
	drawRectAsThinLines(p1, -vx, vz, a, b);

	/****************************Copy/create Insulation vairables*******************/
	double copya = a, copyb = b, copyA = A, copyB = B;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		a += 2 * size;  b += 2 * size;  A += 2 * size;  B += 2 * size;

		FdPoint3d p1, p2, p3, p4, p5;
		p1.set( l / 2.0,                       0, 0);
		p2.set( l / 2.0 - l2           + size, 0, 0);
		p3.set( l / 2.0 - l2 - l3      + size, 0, 0);
		p4.set( l / 2.0 - l2 - l3 - l4 - size, 0, 0);
		p5.set(-l / 2.0,                       0, 0);
		FdPoint3d centralPointsD[6] = { p1, p2, p3, p4, p4, p5 };
		FdVector3d vectorsD[6] = { vx, vx, vx, vx, vx, vx };
		FdVector3d upVectorsD[6] = { vz, vz, vz, vz, vz, vz };
		double tabWidth[6] = { b, b, B, B, b, b };
		double tabHeight[6] = { a, a, A, A, a, a };
		bool sides[24];
		for( int i = 0; i < 24; i++ )
			sides[i] = true;
		makeBox(5, centralPointsD, vectorsD, upVectorsD, tabWidth, tabHeight, sides, false, false, 5, 5, CONNECTOR_SIZE);

		if( flange_1 < size )
			makeRectangularFlange(p1, vx, vz, a - 2 * size + 2 * flange_2, b - 2 * size + 2 * flange_2, size - flange_2);
		if( flange_2 < size )
			makeRectangularFlange(p5, vx, vz, a - 2 * size + 2 * flange_1, b - 2 * size + 2 * flange_1, size - flange_1);
	}

	/**********************************Recover variables*******************************/
	a = copya;  b = copyb;  A = copyA;  B = copyB;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		a -= 2 * size;  b -= 2 * size;  A -= 2 * size;  B -= 2 * size;

		FdPoint3d p1, p2;
		p1.set( l / 2.0, 0, 0);
		p2.set(-l / 2.0, 0, 0);

		FdPoint3d centralPointsD[2] = { p1, p2 };
		FdVector3d vectorsD[2] = { vx, vx };
		FdVector3d upVectorsD[2] = { vz, vz };
		double tabWidth[2] = { b, b };
		double tabHeight[2] = { a, a };
		bool sides[4] = { true, true, true, true };
		makeBox(1, centralPointsD, vectorsD, upVectorsD, tabWidth, tabHeight, sides, false, false, 0, 0, size);
	}
}

void GLEAccesories :: makeRS1(double a, double b, double l, double flange_1, double flange_2)
{
	FdPoint3d p1(-l / 2, 0, 0),
	          p2( l / 2, 0, 0);

	// make box
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
	makeSilencerSymbol(p1, vz, vy, a, l / 2);

	p1.set(0, a / 2, 0);
	makeSilencerSymbol(p1, vy, -vz, b, l / 2);

	p1.set(0, 0, -b / 2);
	makeSilencerSymbol(p1, -vz, -vy, a, l / 2);

	p1.set(0, -a / 2, 0);
	makeSilencerSymbol(p1, -vy, vz, b, l / 2);

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

void GLEAccesories::makeIRIS(double l, double d1, double d2, int n)
{
	FdPoint3d p1,p2,p3,p4;
	p1.set(-l/2,0,0); p2.set(-l/40,0,0), p3.set(l/40,0,0), p4.set(l/2,0,0);

	FdPoint3d p[4] = {p2,p2,p3,p3};
	double diams[4] = {d1,d2,d2,d1};
	makeUniVectorTube(p, vx, diams, n, 3, true);

	p[0] = p1; p[1] = p4;
	diams[0] = d1; diams[1] = d1;
	makeUniVectorTube(p, vx, diams, n, 1, true);

	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		d1 += 2 * size;
		d2 += 2 * size;
		p1.set(-l/2,0,0); p2.set(-l/40-size,0,0), p3.set(l/40+size,0,0), p4.set(l/2,0,0);

		FdPoint3d p[4] = {p2,p2,p3,p3};
		double diams[4] = {d1,d2,d2,d1};
		makeUniVectorTube(p, vx, diams, n, 3, true);

		p[0] = p1; p[1] = p4;
		diams[0] = d1; diams[1] = d1;
		makeUniVectorTube(p, vx, diams, n, 1, true);

		makeFlatRing(p1, vx, d1, d1-2*size, n);
		makeFlatRing(p4, vx, d1, d1-2*size, n);
	}
}





// New accesories - by PK - 09.06.02
// RES -> command from library GenRRS
void GLEAccesories::makeRES(double a, double b, double e, double s, double d, double n, double h1, double h2, double h3,
							double l1, double l2, double fls_down, double fls_right)
{
/*
	How the element is divided:
	----------------|
	|       |       |
	|       |       |
	|_______|_______|
	|       |
	|       |
	|       |
	---------
*/

	// declaration of additional variables
	double b1 = b/cos(0.25*M_PI);
	double size;

	// declaration of start / center points
	FdPoint3d p1(0, -(e+0.5*b), 0);  // bottom flange
	FdPoint3d p2(0, -0.5*b, 0);      // starting point of first half of the box
	FdPoint3d p3(0, 0.5*b, 0);       // starting point of first half of the box
	FdPoint3d pw(0, 0, 0);           // placing point (start point of second half of the box)
	FdPoint3d p4(0.5*b, 0, 0);       // start point of right box
	FdPoint3d p5((e+0.5*b), 0, 0);   // start point of right flange

	FdPoint3d bottomCPoints[3] = {p1, p1, p2};
	FdPoint3d midelCPoints[3] = {p2, p3};
	FdPoint3d rightCPoints[3] = {p4, p5, p5};

	// vectors
	FdVector3d bottomVectorsD[3] = {vy, vy, vy};
	FdVector3d bottomVectorsUp[3] = {vx, vx, vx} ;
	FdVector3d rightVectorsD[3] = {vx, vx, vx};
	FdVector3d rightVectorsUp[3] = {-vy, -vy, -vy} ;

	// sides
	bool sides[8] = {true, true, true, true,
					true, true, true, true};
	bool midleSides[4] = {true, true, false, true};

	// dimensions
	double bottomWidth[3] = {a+2*fls_down, a, a};
	double bottomHeight[3] = {b+2*fls_down, b, b};
	double midleWidth[3] = {a, a};
	double midleHeight[3] = {b, b};
	double rightWidth[3] = {a, a, a+2*fls_right};
	double rightHeight[3] = {b, b, b+2*fls_right};

	bool connectors[2] = {false, false};

	makeBox(2, bottomCPoints, bottomVectorsD, bottomVectorsUp, bottomWidth, bottomHeight, sides, false, false, 5, 5, 0);
	makeBox(1, midelCPoints, midleWidth, midleHeight, midleSides, connectors, false, true);
	makeBox(2, rightCPoints, rightVectorsD, rightVectorsUp, rightWidth, rightHeight, sides, false, false, 5, 5, 0);

	// ereasing extra lines
	bool eraseSide[4] = {true, false, true, true};

	addEraseRect(p2, vy, vz, a, b, eraseSide);
	addEraseRect(p4, vx, vz, a, b, eraseSide);

	// external insulation
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		// declaration of additional variables
		double ina = a + 2*size;
		double inb = b + 2*size;
		double inb1 = inb/cos(0.25*M_PI);

		// declaration of start / center points
		FdPoint3d inp1(0, -(e+0.5*b), 0);   // bottom flange
		FdPoint3d inp2(0, -0.5*b-size, 0);  // end point of bottom insulation (midle part)
		FdPoint3d inp3(0, 0.5*b+size, 0);   // end point of bottom insulation

		FdPoint3d inpw(0, 0, 0);            // placing point (start point of second half of the box)
		FdPoint3d inp4(0.5*b+size, 0, 0);   // start point of right insulation
		FdPoint3d inp5((e+0.5*b), 0, 0);    // end point of right insulation

		FdPoint3d bottomCPoints[3] = {inp1, inp1, inp2};
		FdPoint3d midelCPoints[3] = {inp2, inp3};
		FdPoint3d rightCPoints[3] = {inp4, inp5, inp5};

		FdVector3d bottomVectorsD[3] = {vy, vy, vy};
		FdVector3d bottomVectorsUp[3] = {vx, vx, vx} ;
		FdVector3d rightVectorsD[3] = {vx, vx, vx};
		FdVector3d rightVectorsUp[3] = {-vy, -vy, -vy} ;

		// sides
		bool sides[8] = { true, true, true, true,
		                  true, true, true, true };
		bool midleSides[4] = { true, true, false, true };

		// insulation dimensions
		double bottomWidth[3] = {a, ina, ina};
		double bottomHeight[3] = {b, inb, inb};
		double midleWidth[3] = {ina, ina};
		double midleHeight[3] = {inb, inb};
		double rightWidth[3] = {ina, ina, a};
		double rightHeight[3] = {inb, inb, b};

		bool connectors[2] = {false, false};

		makeBox(2, bottomCPoints, bottomVectorsD, bottomVectorsUp, bottomWidth, bottomHeight, sides, false, false, 5, 5, 0);
		makeBox(1, midelCPoints, midleWidth, midleHeight, midleSides, connectors, false, true);
		makeBox(2, rightCPoints, rightVectorsD, rightVectorsUp, rightWidth, rightHeight, sides, false, false, 5, 5, 0);
	}

	// symbolic internal plane lines
	double dh = 0;

	// on top and bottom
	if( h1 == e )  dh = 0.01;  // to avoid that lines overlap each other
	FdPoint3d s0(-0.5*b, -(0.5*b+e)+0.5*h1, 0.5*a), s1(-0.5*b+l1, -(0.5*b+e)+0.5*h1, 0.5*a); makeSymbolicLine(s0, s1);        // first bottom line on top view
	s0.set(-0.5*b, -(0.5*b+e)+0.5*h1, -0.5*a), s1.set(-0.5*b+l1, -(0.5*b+e)+0.5*h1, -0.5*a); makeSymbolicLine(s0, s1);        // first bottom line on bottom view

	s0.set(0.5*b-l1, -(0.5*b+e)+h1+dh, 0.5*a), s1.set(0.5*b, -(0.5*b+e)+h1+dh, 0.5*a); makeSymbolicLine(s0, s1);              // second bottom line on bottom view
	s0.set(0.5*b-l1, -(0.5*b+e)+h1+dh, -0.5*a), s1.set(0.5*b, -(0.5*b+e)+h1+dh, -0.5*a); makeSymbolicLine(s0, s1);            // second bottom line on bottom view

	s0.set(-0.5*b, -(0.5*b+e)+0.5*h1+h3, 0.5*a), s1.set(-0.5*b+l1, -(0.5*b+e)+0.5*h1+h3, 0.5*a); makeSymbolicLine(s0, s1);    // third bottom line on top view
	s0.set(-0.5*b, -(0.5*b+e)+0.5*h1+h3, -0.5*a), s1.set(-0.5*b+l1, -(0.5*b+e)+0.5*h1+h3, -0.5*a); makeSymbolicLine(s0, s1);  // third bottom line on bottom view

	s0.set((0.5*b+e)-0.5*h1, 0.5*b-l1, 0.5*a), s1.set((0.5*b+e)-0.5*h1, 0.5*b, 0.5*a); makeSymbolicLine(s0, s1);              // first top line on top view
	s0.set((0.5*b+e)-0.5*h1, 0.5*b-l1, -0.5*a), s1.set((0.5*b+e)-0.5*h1, 0.5*b, -0.5*a); makeSymbolicLine(s0, s1);            // first top line on bottom view

	s0.set((0.5*b+e)-h1+dh, -0.5*b, 0.5*a), s1.set((0.5*b+e)-h1+dh, -0.5*b+l1, 0.5*a); makeSymbolicLine(s0, s1);              // second top line on bottom view
	s0.set((0.5*b+e)-h1+dh, -0.5*b, -0.5*a), s1.set((0.5*b+e)-h1+dh, -0.5*b+l1, -0.5*a); makeSymbolicLine(s0, s1);            // second top line on bottom view

	s0.set((0.5*b+e)-0.5*h1-h3, 0.5*b-l1, 0.5*a), s1.set((0.5*b+e)-0.5*h1-h3, 0.5*b, 0.5*a); makeSymbolicLine(s0, s1);        // third top line on top view
	s0.set((0.5*b+e)-0.5*h1-h3, 0.5*b-l1, -0.5*a), s1.set((0.5*b+e)-0.5*h1-h3, 0.5*b, -0.5*a); makeSymbolicLine(s0, s1);      // third top line on bottom view

	// on left and back view
	if( h2 == e )  dh = 0.01;  // to avoid that lines overlap each other
	s0.set(-0.5*b, 0.5*b-0.5*h2, 0.5*a); s1.set(-0.5*b, 0.5*b-0.5*h2, 0.5*a-l2); makeSymbolicLine(s0, s1);      // first line on left view (from right side)
	s0.set(-0.5*b+0.5*h2, 0.5*b, 0.5*a); s1.set(-0.5*b+0.5*h2, 0.5*b, 0.5*a-l2); makeSymbolicLine(s0, s1);      // first line on back view (from left side)

	s0.set(-0.5*b, 0.5*b-1*h2-dh, -0.5*a); s1.set(-0.5*b, 0.5*b-1*h2-dh, -0.5*a+l2); makeSymbolicLine(s0, s1);  // second line on left view (from right side)
	s0.set(-0.5*b+1*h2+dh, 0.5*b, -0.5*a); s1.set(-0.5*b+1*h2+dh, 0.5*b, -0.5*a+l2); makeSymbolicLine(s0, s1);  // second line on back view (from left side)

	s0.set(-0.5*b, 0.5*b-1.5*h2, 0.5*a); s1.set(-0.5*b, 0.5*b-1.5*h2, 0.5*a-l2); makeSymbolicLine(s0, s1);      // third line on left view (from right side)
	s0.set(-0.5*b+1.5*h2, 0.5*b, 0.5*a); s1.set(-0.5*b+1.5*h2, 0.5*b, 0.5*a-l2); makeSymbolicLine(s0, s1);      // third line on back view (from left side)

	s0.set(-0.5*b, 0.5*b-2*h2-dh, -0.5*a); s1.set(-0.5*b, 0.5*b-2*h2-dh, -0.5*a+l2); makeSymbolicLine(s0, s1);  // fourth line on left view (from right side)
	s0.set(-0.5*b+2*h2+dh, 0.5*b, -0.5*a); s1.set(-0.5*b+2*h2+dh, 0.5*b, -0.5*a+l2); makeSymbolicLine(s0, s1);  // fourth line on back view (from left side)

	s0.set(-0.5*b, 0.5*b-2.5*h2, 0.5*a); s1.set(-0.5*b, 0.5*b-2.5*h2, 0.5*a-l2); makeSymbolicLine(s0, s1);      // fifth line on left view (from right side)
	s0.set(-0.5*b+2.5*h2, 0.5*b, 0.5*a); s1.set(-0.5*b+2.5*h2, 0.5*b, 0.5*a-l2); makeSymbolicLine(s0, s1);      // fifth line on back view (from left side)
}

// RRS -> command from library GenRRS
void GLEAccesories::makeRRS(double a, double b, double a0, double b0, double h0, double f0, double alfa)
{
	// declaration of additional variables
	long double radAlfa = alfa*M_PI/180;
	double size;

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

	FdVector3d v1(-1, 0, -tan(0.5*M_PI-radAlfa));  // normalized normal vector to bottom plane

	// main box
	double tabHeight[5] = {a1, a2, a0, a};
	double tabWidth[5] = {b1, b2, b0, b};

	FdPoint3d centralPoints[5] = {p1, p1, p3, p3};

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

	// external insulation
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double ext_b2 = (b0+2*size)/cos(radAlfa);    // width of the pottom flange
		double ext_a2 = a0+2*size;                   // height of the bottom flange
		double ext_dz = (0.5*b0+size)*tan(radAlfa);  // start point of main box (on z axis)
		double ext_b3 = b0/cos(radAlfa);
		double ext_a3 = a0;

		p0.set(0, 0, -ext_dz);                       // start point of bottom box
		p1.set(0, 0, 0.01);                          // start point of plane
		p2.set(0, 0, ext_dz);                        // start point of top box
		p3.set(0, 0, h0+dz);                         // end point of element
		FdPoint3d p4(0, 0, h0+dz+size);              // end point of element

		// main box
		double ext_tabHeight[5] = {a, a, a0+2*size, ext_a2, a2};
		double ext_tabWidth[5] = {b, b, b0+2*size, ext_b2, b2};

		FdPoint3d ext_centralPoints[5] = {p3, p4, p4, p1, p1};

		FdVector3d ext_vectorsD[5] = { -vz, -vz, -vz, v1, v1} ;
		FdVector3d ext_vectorsUp[5] = {-vy, -vy, -vy, -vy, -vy};

		makeBox(4,ext_centralPoints,ext_vectorsD,ext_vectorsUp,ext_tabWidth,ext_tabHeight,sides,false,false,5,5,0);
	}

	// internal insulation
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		double int_b2 = (b0-2*size)/cos(radAlfa);    // width of the pottom flange
		double int_a2 = a0-2*size;                   // height of the bottom flange
		double int_dz = (0.5*b0-size)*tan(radAlfa);  // start point of main box (on z axis)
		double int_b3 = b0/cos(radAlfa);
		double int_a3 = a0;

		p0.set(0, 0, -int_dz);                       // start point of bottom box
		p1.set(0, 0, 0);                             // start point of plane
		p2.set(0, 0, int_dz);                        // start point of top box
		p3.set(0, 0, h0+dz-size);                    // end point of element internal insualtion
		FdPoint3d p4(0, 0, h0+dz);                   // end point of element

		// main box
		double int_tabHeight[5] = {int_a3, int_a2, a0-2*size, a, a};
		double int_tabWidth[5] = {int_b3, int_b2, b0-2*size, b, b};

		FdPoint3d int_centralPoints[5] = {p1, p1, p3, p3, p4};

		FdVector3d int_vectorsD[6] = { v1, v1, -vz, -vz, -vz} ;
		FdVector3d int_vectorsUp[6] = {-vy, -vy, -vy, -vy, -vy};

		makeBox(4,int_centralPoints,int_vectorsD,int_vectorsUp,int_tabWidth,int_tabHeight,sides,false,false,5,5,0);
	}
}

// RH3 -> command from library GenRH3
void GLEAccesories :: makeRH3(double a, double b, double l, double l1, double l2, double h, double a1, double s1cp, double s2cp, double s3cp, double flange_1, double flange_2)
{
	double width = a;
	double height = b;

	// defining start / center points
	FdPoint3d p1(-l / 2, 0, 0), p2(l / 2, 0, 0);  // start / endpoint of duct
	FdPoint3d p3(0, -b / 2, a / 2 - a1 - l1 / 2), p4(0, -b / 2 - h, a / 2 - a1 - l1 / 2), p5(0, -b / 2 - h, a / 2 - a1 - l1 / 2);  // start / endpoint of the heater

	FdPoint3d ductCPoints[2] = { p1, p2 };
	FdPoint3d heaterCPoints[2] = { p3, p4 };

	// defining height
	double ductTWidth[2] = { a, a };
	double ductTHeight[2] = { b, b };
	double heaterTWidth[2] = { l1, l1 };
	double heaterTHeight[2] = { l2, l2 };


	bool sides[4] = { true, true, true, true };
	bool connectors[2] = { false, false };

	// duct
	makeBox(1, ductCPoints, ductTWidth, ductTHeight, false);

	// heater
	makeBox(1, heaterCPoints, heaterTWidth, heaterTHeight, sides, connectors, false, true);

	addRectangularConnector(p1, vx, vy, b + 2 * flange_1, a + 2 * flange_1);
	addRectangularConnector(p2, vx, vy, b + 2 * flange_2, a + 2 * flange_2);
	makeRectangularFlange(p1, vx, vy, b, a, flange_1);
	makeRectangularFlange(p2, vx, vy, b, a, flange_2);

	// add approriate symbol to all four sides
	s1cp = 0.8;  s2cp = 0.8;  s3cp = 0.8;          // proportions for circle sizes
	double c1_diam = 0, c2_diam = 0, c3_diam = 0;  // diameters of big and smal circles

	// scaling diameters
	if( b >= l )    c1_diam = l * s1cp;
	else            c1_diam = b * s1cp;
	if( a >= l )    c2_diam = l * s2cp;
	else            c2_diam = a * s2cp;
	if( l1 >= l2 )  c3_diam = l2 * s3cp;
	else            c3_diam = l1 * s3cp;

	double size;
	if( !getExtInsSize(size) )  // only if insulation doesn't exist
	{
		// drawing side symbols
		FdPoint3d s1(0, 0,  a / 2),
		          s2(0, b / 2, 0),
		          s3(0, 0, -a / 2);
		makeCircleWithPlus(s1,  vz,  vy, c1_diam);
		makeCircleWithPlus(s2,  vy, -vz, c2_diam);
		makeCircleWithPlus(s3, -vz, -vy, c1_diam);

		// drawing heater symbol
		FdPoint3d s4(0, -b / 2 - h, a / 2 - a1 - l1 / 2);
		makeCircleWithPlus(s4, -vy, vz, c3_diam);
	}

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1(-l / 2.0, 0, 0),
		          p2( l / 2.0, 0, 0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabWidth[2] = { a + 2 * size, a + 2 * size };
		double tabHeight[2] = { b + 2 * size, b + 2 * size };
		bool sides[4] = { true, true, true, true };
		makeBox(1, centralPoints, v, upv, tabWidth, tabHeight, sides, false, false, (size > flange_1) ? 0 : 5, (size > flange_2) ? 0 : 5, (flange_1 > flange_2) ? (flange_2 - size) : (flange_1 - size));

		// add approriate symbol to all four sides
		// drawing side symbols
		FdPoint3d s1(0, 0,  a / 2 + size),
		          s2(0, b / 2 + size, 0),
		          s3(0, 0, -a / 2 - size);
		makeCircleWithPlus(s1,  vz,  vy, c1_diam);
		makeCircleWithPlus(s2,  vy, -vz, c2_diam);
		makeCircleWithPlus(s3, -vz, -vy, c1_diam);

		// drawing heater symbol
		FdPoint3d s4(0, -b / 2 - h, a / 2 - a1 - l1 / 2);
		makeCircleWithPlus(s4, -vy, vz, c3_diam);
	}
}

// RD2 -> command from library GenRD2
void GLEAccesories :: makeRD2(double a, double b, double l, double sa, double sb, double sl, double sd, double a_aux)
{
	double width = a;
	double height = b;
	double wTran = sa;
	double hTran = sb;

	// defining start / center points
	FdPoint3d p1(-l / 2, 0, 0), p2(l / 2, 0, 0);  // start / endpoint of duct
	// top symbol
	FdPoint3d tc1(0, 0,  a / 2), ts1(-l / 2 + sl,  b / 2 - sb,  a / 2), ts2(l / 2 - sl, -b / 2 + sb,  a / 2);  // centerpoint and start / endpoint of symbol
	// bottom symbol
	FdPoint3d bc1(0, 0, -a / 2), bs1(-l / 2 + sl,  b / 2 - sb, -a / 2), bs2(l / 2 - sl, -b / 2 + sb, -a / 2);  // centerpoint and start / endpoint of symbol
	// front symbol
	FdPoint3d fc1(0, -b / 2, 0), fs1(-l / 2 + sl, -b / 2, -a / 2 + sa), fs2(l / 2 - sl, -b / 2,  a / 2 - sa);  // centerpoint and start / endpoint of symbol
	// back symbol
	FdPoint3d kc1(0,  b / 2, 0), ks1(-l / 2 + sl,  b / 2, -a / 2 + sa), ks2(l / 2 - sl,  b / 2,  a / 2 - sa);  // centerpoint and start / endpoint of symbol

	FdPoint3d ductCPoints[2] = { p1, p2 };

	// defining height
	double ductTWidth[2] = { a, a };
	double ductTHeight[2] = { b, b };

	bool sides[4] = { true, true, true, true };
	bool connectors[2] = { false, false };

	// duct
	makeBox(1, ductCPoints, ductTWidth, ductTHeight,true);

	double cs = CONNECTOR_SIZE;
	addRectangularConnector(p1, vx, vy, a + 2 * cs, b + 2 * cs);
	addRectangularConnector(p2, vx, vy, a + 2 * cs, b + 2 * cs);

	double size;
	if( !getExtInsSize(size) )  // only if insulation doesn't exist
	{
	// add approriate symbol to all four sides
		// top
		makeSymbolicCircle(tc1, vz, sd);
		makeSymbolicLine(ts1, ts2);
		// bottom
		makeSymbolicCircle(bc1, vz, sd);
		makeSymbolicLine(bs1, bs2);
		// front
		makeSymbolicCircle(fc1, vy, sd);
		makeSymbolicLine(fs1, fs2);
		// back
		makeSymbolicCircle(kc1, vy, sd);
		makeSymbolicLine(ks1, ks2);
	}

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1(-l / 2.0, 0, 0),
		          p2( l / 2.0, 0, 0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabWidth[2] = { a + 2 * size, a + 2 * size };
		double tabHeight[2] = { b + 2 * size, b + 2 * size };
		bool sides[4] = { true, true, true, true };
		makeBox(1, centralPoints, v, upv, tabWidth, tabHeight, sides, false, false, (size > CONNECTOR_SIZE) ? 0 : 5, (size > CONNECTOR_SIZE) ? 0 : 5, CONNECTOR_SIZE - size);

		// top symbol
		FdPoint3d tc1(0, 0,  a / 2 + size), ts1(-l / 2 + sl,  b / 2 - sb,  a / 2 + size), ts2(l / 2 - sl, -b / 2 + sb,  a / 2 + size);  // centerpoint and start / endpoint of symbol
		// bottom symbol
		FdPoint3d bc1(0, 0, -a / 2 - size), bs1(-l / 2 + sl,  b / 2 - sb, -a / 2 - size), bs2(l / 2 - sl, -b / 2 + sb, -a / 2 - size);  // centerpoint and start / endpoint of symbol
		// front symbol
		FdPoint3d fc1(0, -b / 2 - size, 0), fs1(-l / 2 + sl, -b / 2 - size, -a / 2 + sa), fs2(l / 2 - sl, -b / 2 - size,  a / 2 - sa);  // centerpoint and start / endpoint of symbol
		// back symbol
		FdPoint3d kc1(0,  b / 2 + size, 0), ks1(-l / 2 + sl,  b / 2 + size, -a / 2 + sa), ks2(l / 2 - sl,  b / 2 + size,  a / 2 - sa);  // centerpoint and start / endpoint of symbol

	// add approriate symbol to all four sides
		// top
		makeSymbolicCircle(tc1, vz, sd);
		makeSymbolicLine(ts1, ts2);
		// bottom
		makeSymbolicCircle(bc1, vz, sd);
		makeSymbolicLine(bs1, bs2);
		// front
		makeSymbolicCircle(fc1, vy, sd);
		makeSymbolicLine(fs1, fs2);
		// back
		makeSymbolicCircle(kc1, vy, sd);
		makeSymbolicLine(ks1, ks2);
	}
}

// CCC -> command from library GenCCC
void GLEAccesories::makeCCC(double d0, double a, double b, double h, double h1, double h2, double l, double f,
                            double c, double d, double a0, double b0, double n)
{
	FdPoint3d s1(-a/2, 0, 0), s2(a/2, 0, 0);                // center points for tube
	FdPoint3d p1(0, (d0/2+h-0.01), 0), p2(0, (d0/2+h), 0);  // center points for heater

	// main tube
	double mainTubeData[3] = {d0, d0, a};
	double ductPosition[2] = {a/2, 0};
	double ductParam[3] = {a, b, d0/2+h};

	// make intersected duct and tube
	makeRectToTubeIntersection(s1, vx, -vz, mainTubeData, ductPosition, ductParam, n);

	// cap
	FdPoint3d centralPoints[2] = {p1,p2};
	double tabWidth[2] = {b,b};
	double tabHeight[2]= {a,a};

	bool sides[4] = {true, true, true, true};
	bool connectors[2] = {false, false};

	makeBox(1, centralPoints, tabWidth, tabHeight, sides, connectors, false, true);

	// handle
	FdPoint3d s3(-(f/2-l/2), (d0/2+h), 0), s4(-(f/2-l/2), (d0/2+h+h1), 0);  // points of tube 1 part of handle
	FdPoint3d s5((f/2-l/2), (d0/2+h), 0), s6((f/2-l/2), (d0/2+h+h1), 0);    // points of tube 2 part of handle

	FdPoint3d t1CPoints[3] = {s3, s4, s4};  // center points of tube 1
	FdPoint3d t2CPoints[3] = {s5, s6, s6};  // center points of tube 2

	FdVector3d t1NVect[3] = {vy, vy, vy};
	FdVector3d t2NVect[3] = {vy, vy, vy};
	FdVector3d t1UVect[3] = {-vz, -vz, -vz};
	FdVector3d t2UVect[3] = {vz, vz, vz};
	double tDiam[3][2] = { l, l, l, l,
	                       0.00, 0.00 };

	makeTube(t1CPoints, t1NVect, t1UVect, tDiam, n, 2, true, true);  // tube 1
	makeTube(t2CPoints, t2NVect, t2UVect, tDiam, n, 2, true, true);  // tube 1

	// handle connecting box
	FdPoint3d p3(0, (d0/2+h), 0), p4(0, (d0/2+h+h1), 0);
	FdPoint3d cbCentPoints[2] = {p3, p4};

	double cbTabWidth[2] = {l, l};
	double cbTabHeight[2] = {f-l, f-l};
	bool cbSides[4] = {false, true, false, true};
	bool cbConnectors[2] = {false, false};

	makeBox(1, cbCentPoints, cbTabWidth, cbTabHeight, cbSides, cbConnectors, false, true);

	// symbolic circles
	FdPoint3d s7(-c/2, (d0/2+h+h1), 0), s8(c/2, (d0/2+h+h1), 0);
	makeSymbolicCircle(s7, vy, d);
	makeSymbolicCircle(s8, vy, d);

	// deleting additional lines
	FdPoint3d p5(-(f/2-l/2), (d0/2+h+h1), -l/2), p6(-(f/2-l/2), (d0/2+h+h1), l/2);
	FdPoint3d p7((f/2-l/2), (d0/2+h+h1), -l/2), p8((f/2-l/2), (d0/2+h+h1), l/2);

	addEraseLine(p5, p6);
	addEraseLine(p7, p8);
}

// RCC -> command from library GenRCC
void GLEAccesories::makeRCC(double d0, double a, double b, double h, double h1, double h2, double l, double f,
                            double c, double d, double a0, double b0, double n)
{
	FdPoint3d s1(-a/2, 0, 0), s2(a/2, 0, 0);  // center points for tube
	FdPoint3d p1(0, 0, 0), p2(0, h, 0);       // center points for heater

	// bottom box + flange
	FdPoint3d centralPoints[3] = {p1, p1, p2};
	double tabWidth[3] = {a0, a, a};
	double tabHeight[3] = {b0, b, b};

	FdVector3d vectorsD[3] = {vy, vy, vy};
	FdVector3d vectorsUp[3] = {vz, vz, vz};

	bool sides[16] = { true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true };
	bool connectors[2] = { false, false };

	makeBox(2, centralPoints, vectorsD,vectorsUp,tabWidth,tabHeight,sides,false,true,5,5,0);  // box

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

// RVAV -> command from library GenRVAV
void GLEAccesories::makeRVAV(double a, double b, double l, double l1, double l2, double h,
                             double h1, double h2, double h3)
{
	// start / end points of element
	FdPoint3d s1(-l/2, 0, 0), s2(l/2, 0, 0);                               // main box
	FdPoint3d s3((l/2-l2-l1/2), -b/2, 0), s4((l/2-l2-l1/2), -(b/2+h), 0);  // regulation box

	// start / end points of symbols
	FdPoint3d p1(-l/2, h3/2, a/2), p2(l/2, (b/2-h1), a/2);                 // top symb. line 1
	FdPoint3d p3(-l/2, -h3/2, a/2), p4(l/2, -(b/2-h1), a/2);               // top symb. line 2

	FdPoint3d p5(-l/2, h3/2, -a/2), p6(l/2, (b/2-h1), -a/2);               // bottom symb. line 1
	FdPoint3d p7(-l/2, -h3/2, -a/2), p8(l/2, -(b/2-h1), -a/2);             // bottom symb. line 2

	// drawing main box
	FdPoint3d mainCPoints[2] = {s1, s2};

	FdVector3d mainNormVect[2] = {vx, vx};
	FdVector3d mainUpVect[2] = {vz, vz};

	double mainBWidth[2] = {b, b};
	double mainBHeight[2] = {a, a};

	bool sides[4] = {true, true, true, true};

	makeBox(1, mainCPoints, mainNormVect, mainUpVect, mainBWidth, mainBHeight, sides, false, false, 0, 0, 30);

	// drawing regulation box
	FdPoint3d regCPoints[2] = {s3, s4};

	FdVector3d regNormVect[2] = {vx, vx};
	FdVector3d regUpVect[2] = {vz, vz};

	double regBWidth[2] = {h2, h2};
	double regBHeight[2] = {l1, l1};

	bool regConnect[2] = {false, false};

	makeBox(1, regCPoints, regBWidth, regBHeight, sides, regConnect, true, true);

	// insulation
	double size = 0;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		// for symbols on insulation
		p1.set(-l/2, h3/2, a/2+size); p2.set(l/2, (b/2-h1), a/2+size);      // top symb. line 1
		p3.set(-l/2, -h3/2, a/2+size); p4.set(l/2, -(b/2-h1), a/2+size);    // top symb. line 2

		p5.set(-l/2, h3/2, -a/2-size); p6.set(l/2, (b/2-h1), -a/2-size);    // bottom symb. line 1
		p7.set(-l/2, -h3/2, -a/2-size); p8.set(l/2, -(b/2-h1), -a/2-size);  // bottom symb. line 2

		// insulation of main box
		s1.set(-l/2+0.01, 0, 0); s2.set(l/2-0.01, 0, 0);

		FdPoint3d insMCPoints[4] = {s1, s1, s2, s2};

		FdVector3d insMNormVect[4] = {vx, vx, vx, vx};
		FdVector3d inMUpVect[4] = {vz, vz, vz, vz};

		double insMBWidth[4] = {b, b+2*size, b+2*size, b};
		double insMBHeight[4] = {a, a+2*size, a+2*size, a};

		bool insSides[12] = { true, true, true, true,
		                      true, true, true, true,
		                      true, true, true, true };
		bool insConnect[2] = { false, false };

		makeBox(3, insMCPoints, insMNormVect, inMUpVect, insMBWidth, insMBHeight, insSides, false, false, 5, 5, 0);
	}

	// drawing symbols
	makeSymbolicLine(p1, p2); makeSymbolicLine(p3, p4);
	makeSymbolicLine(p5, p6); makeSymbolicLine(p7, p8);
}

// RHU -> command from library GenRHU
void GLEAccesories::makeRHU(double a, double b, double l, double sb, double sb1, double sa, double sa1,  double sl1, double sl2, double sl3, double s1cp, double s2cp, double s3cp, double s4cp, double fls)
{
	FdPoint3d p0(0, 0, 0);  // insertion point

	// definition of the points and vectors for the main box
	FdPoint3d p1( -l/2, 0, 0), p2( l/2, 0, 0);  // start and endpoint of the main box
	FdPoint3d centralPoint[2] = {p1, p2};

	FdVector3d vectorD[2] = {vx, vx};  // normal vectors of the main box
	FdVector3d vectorUp[2] = {vz, vz};

	// definition of the main box dimensions
	double mainBoxWidth[2] = { b, b};
	double mainBoxHeight[2] = { a, a};

	bool sides[4] = {true, true, true, true};

	makeBox( 1, centralPoint, vectorD, vectorUp, mainBoxWidth, mainBoxHeight, sides, false, false, 0, 0, fls);

	// insulation
	double size = 0;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		// definition of the points and vectors for the main box
		FdPoint3d pIns1( -l/2+0.1, 0, 0), pIns2( l/2-0.1, 0, 0);  // start and endpoint of the main box
		FdPoint3d centralInsPoint[4] = {pIns1, pIns1, pIns2, pIns2};
		FdVector3d vectorInsD[4] = {vx, vx, vx, vx};  // normal vectors of the main box
		FdVector3d vectorInsUp[4] = {vz, vz, vz, vz};

		// definition of the main box dimensions
		double mainBoxInsWidth[4] = { b, b+2*size, b+2*size, b};
		double mainBoxInsHeight[4] = { a, a+2*size, a+2*size, a};

		bool connectors[2] = { false, false };
		bool insSides[12] = { true, true, true, true,
		                      true, true, true, true,
		                      true, true, true, true };

		makeBox( 3, centralInsPoint, vectorInsD, vectorInsUp, mainBoxInsWidth, mainBoxInsHeight, insSides, false, false, 0, 0, 0);
	}

// drawing symbols
	// p1.y = b/2; p2.y = b/3;
	// p1.z = a/2; p2.z = a/2;
	// for (int j = 0; j < 2; j++) {
	// 		p1.y -= j*b/2;	p2.y -= j*b/2;
	// 		for (int i = 0; i < 2; i++) {
	// 			p1.z = -1*p1.z; p2.z = -1*p2.z;
	// 			makeSymbolicLine(p1, p2);
	// 	}
	// }

  // left side from top
	FdPoint3d p3, p4;
	p1.set(-l/2        ,sb       , a/2 + size);
	p2.set(-l/2 + sl3  ,(sb*2/3) , a/2 + size);
	p3.set(-l/2 + sl3  ,(sb*1/3) , a/2 + size);
	p4.set(-l/2        ,0        , a/2 + size);
	makeSymbolicLine(p1, p2);
	makeSymbolicLine(p2, p3);
	makeSymbolicLine(p3, p4);

  // right side from top
	p1.y = -1*p1.y;
	p2.y = -1*p2.y;
	p3.y = -1*p3.y;
	makeSymbolicLine(p1, p2);
	makeSymbolicLine(p2, p3);
	makeSymbolicLine(p3, p4);

  // right side from bottom
	p1.set(-l/2,  sb, -a/2 - size);
	p2.set(-l/2 + sl3, (sb*2/3), -a/2 - size);
	p3.set(-l/2 + sl3, (sb*1/3), -a/2 - size);
	p4.set(-l/2, 0, -a/2 - size);
	makeSymbolicLine(p1, p2);
	makeSymbolicLine(p2, p3);
	makeSymbolicLine(p3, p4);

  // left side from bottom
	p1.y = -1*p1.y;
	p2.y = -1*p2.y;
	p3.y = -1*p3.y;
	makeSymbolicLine(p1, p2);
	makeSymbolicLine(p2, p3);
	makeSymbolicLine(p3, p4);

  // right side from back
	p1.set(-l/2,  b/2 + size, sa);
	p2.set(-l/2 + sl3, b/2 + size, (sa*2/3));
	p3.set(-l/2 + sl3, b/2 + size, (sa*1/3));
	p4.set(-l/2, b/2 + size, 0);
	makeSymbolicLine(p1, p2);
	makeSymbolicLine(p2, p3);
	makeSymbolicLine(p3, p4);

  // left side from back
	p1.z = -1*p1.z;
	p2.z = -1*p2.z;
	p3.z = -1*p3.z;
	p4.z = -1*p4.z;
	makeSymbolicLine(p1, p2);
	makeSymbolicLine(p2, p3);
	makeSymbolicLine(p3, p4);

  // left side form front
	p1.set(-l/2,  -b/2 - size, sa);
	p2.set(-l/2 + sl3, -b/2 - size, (sa*2/3));
	p3.set(-l/2 + sl3, -b/2 - size, (sa*1/3));
	p4.set(-l/2, -b/2 - size, 0);
	makeSymbolicLine(p1, p2);
	makeSymbolicLine(p2, p3);
	makeSymbolicLine(p3, p4);

  // right side from front
	p1.z = -1*p1.z;
	p2.z = -1*p2.z;
	p3.z = -1*p3.z;
	p4.z = -1*p4.z;
	makeSymbolicLine(p1, p2);
	makeSymbolicLine(p2, p3);
	makeSymbolicLine(p3, p4);

// circle with triangle
  // top side
	FdPoint3d s(0, 0, a/2 + size);
	makeCircleWithTriangle(s, vz, vy, s3cp*(min(b,l)));
  // bottom side
	s.set(0, 0, -a/2 - size);
	makeCircleWithTriangle(s, -vz, -vy, s3cp*(min(b,l)));
  // front side
	s.set(0, -b/2 - size, 0);
	makeCircleWithTriangle(s, -vy, vz, s4cp*(min(a,l)));
  // back side
	s.set(0, b/2 + size, 0);
	makeCircleWithTriangle(s, vy, -vz, s4cp*(min(a,l)));

// circle with plus
  // top
	FdPoint3d c(l/2-sl1/2, 0, a/2 + size);
	makeCircleWithPlus(c, vz, vy, s1cp*(min(b,l)));
  // bottom
	c.set(l/2-sl1/2, 0, -a/2 - size);
	makeCircleWithPlus(c, -vz, -vy, s1cp*(min(b,l)));
  // back
	c.set(l/2-sl1/2, b/2 + size, 0);
	makeCircleWithPlus(c, vy, -vz, s2cp*(min(a,l)));
  // front
	c.set(l/2-sl1/2, -b/2 - size, 0);
	makeCircleWithPlus(c, -vy, vz, s2cp*(min(a,l)));

// line around the element
  // top side
	p1.set(-l/2 + (l-(sl2+sl1)), -b/2 - size, a/2 + size);
	p2.set(-l/2 + (l-(sl2+sl1)), b/2 + size, a/2 + size);
	makeSymbolicLine(p1, p2);
  // left side
	p3.set(-l/2 + (l-(sl2+sl1)), b/2 + size, -a/2 - size);
	makeSymbolicLine(p2,p3);
  // bottom side
	p4.set(-l/2 + (l-(sl2+sl1)), -b/2 - size, -a/2 - size);
	makeSymbolicLine(p3, p4);
  // right side
	makeSymbolicLine(p4, p1);

  // top side
	p1.set(l/2 - sl1, -b/2 - size, a/2 + size);
	p2.set(l/2 - sl1, b/2 + size, a/2 + size);
	makeSymbolicLine(p1, p2);
  // left side
	p3.set(l/2 - sl1, b/2 + size, -a/2 - size);
	makeSymbolicLine(p2,p3);
  // bottom side
	p4.set(l/2 - sl1, -b/2 - size, -a/2 - size);
	makeSymbolicLine(p3, p4);
  // right side
	makeSymbolicLine(p4, p1);
}

//**********CCAV***********************************************************************************************************
void GLEAccesories::makeCCAV(double d, double l, double sl1, double sd, double sd1)
{
	FdPoint3d p1(-l/2, 0, 0), p2(l/2, 0, 0);

	FdVector3d vectorD[2] = {vx, vx};
	FdVector3d vectorUp[2] = {vz, vz};
	FdPoint3d FDcenterPoints[2] = {p1, p2};

	double diameters[2] = {d, d};
	int n = 40;

	makeSimpleTube(FDcenterPoints, d, d, n);

	// insulation
	double arcSinBeta = asin(1-(2*sd/d))*180 / M_PI, size = 0;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		makeSimpleTube(FDcenterPoints, d+2*size, d+2*size , n);

		p1.set(-l/2, 0, 0);
		makeFlatRing(p1, -vx, d, d+2*size, n);

		p1.set(l/2, 0, 0);
		makeFlatRing(p1, vx, d, d+2*size, n);
	}

	// symbols
	FdPoint3d k(0, 0, 0);                   // ellipse center point
	FdPoint3d pe1(l/2 - sl1, 0, d/2 - sd);  // point on ellipse long axis (necessary to solve ellipse skew angle)

	double alfa = atan((d + 2*size - 2*sd)/(l - 2*sl1));  // ellipse skewing angle
	double longR = (d + 2*size)/(2*sin(alfa));
	double shortR = (d + 2*size)/2;

	FdVector3d radVect(pe1 - k);  // radius vector
	FdVector3d crossVect = vy;    // radius vector
	FdVector3d normVect = radVect.crossProduct(crossVect);

	radVect = radVect.normalize();
	normVect = normVect.normalize();

	makeSymbolicEllipse(k, normVect, radVect, longR, shortR, 90 - arcSinBeta, 90);
	makeSymbolicEllipse(k, normVect, radVect, longR, shortR, 270, 270 + arcSinBeta);

	p1.set(0, -d/2 - size, 0);
	p2.set((-l/2)+(0.1*l), -d/2 - size, 0);
	makeSymbolicLine(p1, p2);

	p1.set(0, d/2 + size, 0);
	p2.set((-l/2)+(0.1*l), d/2 + size, 0);
	makeSymbolicLine(p1, p2);
}

//**********COWD**********************************************************************************************************
void GLEAccesories::makeCOWD(double d, double l, double sl1, double sl2, double sh1, double sh2)
{
	FdPoint3d p1(-l/2, 0, 0), p2(l/2, 0, 0);

	FdVector3d vectorD[2] = {vx, vx};
	FdVector3d vectorUp[2] = {vz, vz};
	FdPoint3d FDcenterPoints[2] = {p1, p2};

	double diameters[2] = {d, d};
	int n = 40;

	makeSimpleTube(FDcenterPoints, d, d, n);

	// insulation
	double size = 0;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		makeSimpleTube(FDcenterPoints, d+2*size, d+2*size , n);

		p1.set(-l/2, 0, 0);
		makeFlatRing(p1, -vx, d, d+2*size, n);

		p1.set(l/2, 0, 0);
		makeFlatRing(p1, vx, d, d+2*size, n);
	}

// symbols
  // front
	p1.set(-sl1/2, - sqrt(pow(d/2+size,2) - pow(sh2/2,2)), sh2/2);
	p2.set(sl1/2 - sl2,  - sqrt(pow(d/2+size,2) - pow(sh2/2,2)), sh2/2);
	makeSymbolicLine(p1, p2);
	p1.set(-sl1/2, - sqrt(pow(d/2+size,2) - pow(sh2/2,2)), -sh2/2);
	p2.set(sl1/2 - sl2,  - sqrt(pow(d/2+size,2) - pow(sh2/2,2)), -sh2/2);
	makeSymbolicLine(p1, p2);

	FdPoint3d center(sl1/2-sl2, 0, 0);
	FdVector3d normal = vx;
	FdVector3d radVect = -vy;
	double tanAlfa = atan( (sh2/2)/ (d/2+size))*180 / M_PI;
	double tanBeta = atan( ((sh1-sh2)/2) / (d/2+size) ) *180 / M_PI;

	makeSymbolicEllipse(center, normal, radVect, (d/2+size), (d/2+size), 360-tanAlfa-tanBeta, 360-tanAlfa);
	makeSymbolicEllipse(center, normal, radVect, (d/2+size), (d/2+size), tanAlfa, tanAlfa + tanBeta);

	center.set(-sl1/2, 0, 0);
	makeSymbolicEllipse(center, normal, radVect, (d/2+size), (d/2+size), 360 - tanAlfa, tanAlfa);

	// arrowhead
	double tanGamma = atan( sl2*1.41 / (d/2 + size) )*180 / M_PI;
	center.set(sl1/2, 0, 0);
	normal = -vx - vz;
	radVect = vz - vx;
	makeSymbolicEllipse(center, normal, radVect, (d+2*size)/2, (d + 2*size)/(2*1.41), 270, 270 + tanGamma );

	normal = vx - vz;
	radVect = vx + vz;
	makeSymbolicEllipse(center, normal, radVect, (d+2*size)/2, (d + 2*size)/(2*1.41), 90, 90 + tanGamma );

  // back
	p1.set(-sl1/2,        sqrt(pow((d/2+size),2) - pow(sh2/2,2)), sh2/2);
	p2.set(sl1/2 - sl2,   sqrt(pow((d/2+size),2) - pow(sh2/2,2)), sh2/2);
	makeSymbolicLine(p1, p2);
	p1.set(-sl1/2,       sqrt(pow((d/2+size),2) - pow(sh2/2,2)), -sh2/2);
	p2.set(sl1/2 - sl2,  sqrt(pow((d/2+size),2) - pow(sh2/2,2)), -sh2/2);
	makeSymbolicLine(p1, p2);

	center.set(sl1/2-sl2, 0, 0);
	normal = vx;
	radVect = vy;
	tanAlfa = atan( (sh2/2)/ ((d/2+size)))*180 / M_PI;
	tanBeta = atan( ((sh1-sh2)/2) / ((d/2+size)) ) *180 / M_PI;

	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/2, 360-tanAlfa-tanBeta, 360-tanAlfa);
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/2, tanAlfa, tanAlfa + tanBeta);

	center.set(-sl1/2, 0, 0);
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/2, 360 - tanAlfa, tanAlfa);

	// arrowhead
	tanGamma = atan( sl2*1.41 / (d/2 + size) )*180 / M_PI;
	center.set(sl1/2, 0, 0);
	normal = -vx - vz;
	radVect = vz - vx;
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/(2*1.41), 90 - tanGamma, 90);

	normal = vx - vz;
	radVect = vx + vz;
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/(2*1.41), 270 - tanGamma, 270);

  // top
	p1.set(-sl1/2,        sh2/2, sqrt(pow((d/2+size),2) - pow(sh2/2,2)));
	p2.set(sl1/2 - sl2,   sh2/2, sqrt(pow((d/2+size),2) - pow(sh2/2,2)));
	makeSymbolicLine(p1, p2);
	p1.set(-sl1/2,       -sh2/2, sqrt(pow((d/2+size),2) - pow(sh2/2,2)));
	p2.set(sl1/2 - sl2,  -sh2/2, sqrt(pow((d/2+size),2) - pow(sh2/2,2)));
	makeSymbolicLine(p1, p2);

	center.set(sl1/2-sl2, 0, 0);
	normal = vx;
	radVect = vz;
	tanAlfa = atan( (sh2/2)/ ((d/2+size)))*180 / M_PI;
	tanBeta = atan( ((sh1-sh2)/2) / ((d/2+size)) ) *180 / M_PI;

	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/2, 360-tanAlfa-tanBeta, 360-tanAlfa);
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/2, tanAlfa, tanAlfa + tanBeta);

	center.set(-sl1/2, 0, 0);
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/2, 360 - tanAlfa, tanAlfa);

	// arrowhead
	tanGamma = atan( sl2*1.41 / (d/2 + size) )*180 / M_PI;
	center.set(sl1/2, 0, 0);
	normal = -vx - vy;
	radVect = -vy + vx;
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/(2*1.41), 270 - tanGamma, 270);

	normal = -vx + vy;
	radVect = vx + vy;
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/(2*1.41), 270 - tanGamma, 270);

  // bottom
	p1.set(-sl1/2,        sh2/2, - sqrt(pow((d/2+size),2) - pow(sh2/2,2)));
	p2.set(sl1/2 - sl2,   sh2/2, - sqrt(pow((d/2+size),2) - pow(sh2/2,2)));
	makeSymbolicLine(p1, p2);
	p1.set(-sl1/2,       -sh2/2, - sqrt(pow((d/2+size),2) - pow(sh2/2,2)));
	p2.set(sl1/2 - sl2,  -sh2/2, - sqrt(pow((d/2+size),2) - pow(sh2/2,2)));
	makeSymbolicLine(p1, p2);

	center.set(sl1/2-sl2, 0, 0);
	normal = vx;
	radVect = -vz;
	tanAlfa = atan( (sh2/2)/ ((d/2+size)))*180 / M_PI;
	tanBeta = atan( ((sh1-sh2)/2) / ((d/2+size)) ) *180 / M_PI;

	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/2, 360-tanAlfa-tanBeta, 360-tanAlfa);
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/2, tanAlfa, tanAlfa + tanBeta);

	center.set(-sl1/2, 0, 0);
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/2, 360 - tanAlfa, tanAlfa);

	// arrowhead
	tanGamma = atan( sl2*1.41 / (d/2 + size) )*180 / M_PI;
	center.set(sl1/2, 0, 0);
	normal = -vx - vy;
	radVect = -vy + vx;
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/(2*1.41), 90, 90 + tanGamma);

	normal = -vx + vy;
	radVect = vx + vy;
	makeSymbolicEllipse(center, normal, radVect, (d + 2*size)/2, (d + 2*size)/(2*1.41), 90, 90 + tanGamma);
}

//**********RCAV**********************************************************************************************************
void GLEAccesories::makeRCAV(double a, double b, double l, double sa, double sb, double sl, double sl1, double sl2, double sd, double fls)
{
	FdPoint3d p1( -l/2, 0, 0), p2( l/2, 0, 0);
	FdPoint3d centralPoint[2] = {p1, p2};

	FdVector3d vectorD[2] = {vx, vx};
	FdVector3d vectorUp[2] = {vz, vz};

	double mainBoxWidth[2] = { b, b};
	double mainBoxHeight[2] = { a, a};

	bool sides[4] = {true, true, true, true};

	makeBox( 1, centralPoint, vectorD, vectorUp, mainBoxWidth, mainBoxHeight, sides, false, false, 0, 0, fls);

	// insulation
	double size = 0;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d pIns1( -l/2, 0, 0), pIns2( l/2, 0, 0);
		FdPoint3d centralInsPoint[4] = {pIns1, pIns1, pIns2, pIns2};
		FdVector3d vectorInsD[4] = {vx, vx, vx, vx};
		FdVector3d vectorInsUp[4] = {vz, vz, vz, vz};

		double mainBoxInsWidth[4] = { b, b+2*size, b+2*size, b};
		double mainBoxInsHeight[4] = { a, a+2*size, a+2*size, a};

		bool connectors[2] = { false, false };
		bool insSides[12] = { true, true, true, true,
		                      true, true, true, true,
		                      true, true, true, true };

		makeBox( 3, centralInsPoint, vectorInsD, vectorInsUp, mainBoxInsWidth, mainBoxInsHeight, insSides, false, false, 0, 0, 0);
	}

// symbols
  // top
	p1.set(0, 0, a/2 + size);
	makeSymbolicCircle(p1, vz, sd);

	p2.set(l/2-sl, 0, a/2 + size);
	makeSymbolicLine(p1, p2);
	// p2.set(-b/2+sb, b/2-sb, a/2 + size);
	p2.set(-l/2+sl1, b/2-sb, a/2 + size);
	makeSymbolicLine(p1, p2);

  // bottom
	p1.set(0, 0, -a/2 - size);
	makeSymbolicCircle(p1, -vz, sd);

	p2.set(-l/2+sl, 0, -a/2 - size);
	makeSymbolicLine(p1, p2);
	// p2.set(b/2-sb, b/2-sb, -a/2 - size);
	p2.set(l/2-sl1, b/2-sb, -a/2 - size);
	makeSymbolicLine(p1, p2);

  // front
	p1.set(0, -b/2 - size, 0);
	makeSymbolicCircle(p1, -vy, sd);

	p2.set(l/2-sl, -b/2 - size, 0);
	makeSymbolicLine(p1, p2);
	// p2.set(-a/2+sb, -b/2 - size, a/2-sb);
	p2.set(-l/2+sl2, -b/2 - size, a/2-sa);
	makeSymbolicLine(p1, p2);

  // back
	p1.set(0, b/2 + size, 0);
	makeSymbolicCircle(p1, vy, sd);

	p2.set(-l/2+sl, b/2 + size, 0);
	makeSymbolicLine(p1, p2);
	// p2.set(a/2-sb, b/2 + size, a/2-sb );
	p2.set(l/2-sl2, b/2 + size, a/2-sa );
	makeSymbolicLine(p1, p2);
}

//**********ROWD***********************************************************************************************************
void GLEAccesories::makeROWD(double a, double b, double l, double sd, double sa, double sb, double sl, double sl1, double sl2, double fls)
{
	FdPoint3d p1( -l/2, 0, 0), p2( l/2, 0, 0);
	FdPoint3d centralPoint[2] = {p1, p2};

	FdVector3d vectorD[2] = {vx, vx};
	FdVector3d vectorUp[2] = {vz, vz};

	double mainBoxWidth[2] = { b, b};
	double mainBoxHeight[2] = { a, a};

	bool sides[4] = {true, true, true, true};

	makeBox( 1, centralPoint, vectorD, vectorUp, mainBoxWidth, mainBoxHeight, sides, false, false, 0, 0, fls);

	// insulation
	double size = 0;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d pIns1( -l/2, 0, 0), pIns2( l/2, 0, 0);
		FdPoint3d centralInsPoint[4] = {pIns1, pIns1, pIns2, pIns2};
		FdVector3d vectorInsD[4] = {vx, vx, vx, vx};
		FdVector3d vectorInsUp[4] = {vz, vz, vz, vz};

		double mainBoxInsWidth[4] = { b, b+2*size, b+2*size, b};
		double mainBoxInsHeight[4] = { a, a+2*size, a+2*size, a};

		bool connectors[2] = { false, false };
		bool insSides[12] = { true, true, true, true,
		                      true, true, true, true,
		                      true, true, true, true };

		makeBox( 3, centralInsPoint, vectorInsD, vectorInsUp, mainBoxInsWidth, mainBoxInsHeight, insSides, false, false, 0, 0, 0);
	}

// symbols
	double arcTanAlfa = atan((b/2-(sb+sl/2))/(l-(sl1+sl)))*180 / M_PI;
	long double radAlfa = arcTanAlfa*M_PI/180;

  // top
	FdPoint3d center(-l/2+sl1, sl2/2, a/2 + size);
	makeSymbolicCircle(center, vz, sd);

	p1.set(-l/2+sl1+(sd/2*cos(radAlfa)), sl2/2+(sd/2*sin(radAlfa)), a/2 + size);
	p2.set(l/2-sl, b/2-sb, a/2 + size);
	makeSymbolicLine(p1, p2);

	center.y = -sl2/2;
	makeSymbolicCircle(center, vz, sd);

	p1.set(-l/2+sl1+(sd/2*cos(radAlfa)), -sl2/2-(sd/2*sin(radAlfa)), a/2 + size);
	p2.set(l/2-sl, -b/2+sb, a/2 + size);
	makeSymbolicLine(p1, p2);

  // bottom
	center.set(-l/2+sl1, sl2/2, -a/2 - size);
	makeSymbolicCircle(center, -vz, sd);

	p1.set(-l/2+sl1+(sd/2*cos(radAlfa)), sl2/2+(sd/2*sin(radAlfa)), -a/2 - size);
	p2.set(l/2-sl, b/2-sb, -a/2 - size);
	makeSymbolicLine(p1, p2);

	center.y = -sl2/2;
	makeSymbolicCircle(center, -vz, sd);

	p1.set(-l/2+sl1+(sd/2*cos(radAlfa)), -sl2/2-(sd/2*sin(radAlfa)), -a/2 - size);
	p2.set(l/2-sl, -b/2+sb, -a/2 - size);
	makeSymbolicLine(p1, p2);

  // back
	center.set(-l/2+sl1, b/2 + size, sl2/2);
	makeSymbolicCircle(center, vy, sd);

	p1.set(-l/2 + sl1 + (sd/2*cos(radAlfa)), b/2 + size, sl2/2 + (sd/2*sin(radAlfa)));
	p2.set(l/2-sl, b/2 + size, a/2-sa);
	makeSymbolicLine(p1, p2);

	center.z = -sl2/2;
	makeSymbolicCircle(center, vy, sd);

	p1.set(-l/2 + sl1 + (sd/2*cos(radAlfa)), b/2 + size, -sl2/2-(sd/2*sin(radAlfa)));
	p2.set(l/2 - sl, b/2 + size, -a/2+sa);
	makeSymbolicLine(p1, p2);

  // front
	center.set(-l/2+sl1, -b/2 - size, sl2/2);
	makeSymbolicCircle(center, -vy, sd);

	p1.set(-l/2 + sl1 + (sd/2*cos(radAlfa)), -b/2 - size, sl2/2 + (sd/2*sin(radAlfa)));
	p2.set(l/2-sl, -b/2 - size, a/2-sa);
	makeSymbolicLine(p1, p2);

	center.z = -sl2/2;
	makeSymbolicCircle(center, -vy, sd);

	p1.set(-l/2 + sl1 + (sd/2*cos(radAlfa)), -b/2 - size, -sl2/2-(sd/2*sin(radAlfa)));
	p2.set(l/2 - sl, -b/2 - size, -a/2+sa);
	makeSymbolicLine(p1, p2);
}

//**********CVAV***********************************************************************************************************
void GLEAccesories::makeCVAV(double d, double l, double a, double b, double e, double l1, double sl1, double sl2, double sh1, double sh2, double sh3, double sh4)
{
	FdPoint3d p(-l/2, 0, 0);
	int n = 40;
	FdPoint3d c1(-l/2, 0, 0), c2(l/2, 0, 0);
	FdPoint3d FDcenterPoints[2] = {c1, c2};

	double tubeParams[3] = {d, d, l};
	double ductPosition[2] = {l-l1-b/2, 0};
	double ductParams[3] = {b, a, d/2 + e};

	makeRectToTubeIntersection(p, vx, vz, tubeParams, ductPosition, ductParams,  n);

	FdPoint3d p1(l/2-l1-b, - e - d/2, - a/2), p2(l/2-l1, - e - d/2, - a/2), p3(l/2-l1, - e - d/2, a/2), p4(l/2-l1 - b, - e - d/2, a/2);
	makePlane(p1, p2, p3, p4);

	makeSimpleTube(FDcenterPoints, d-0.5, d-0.5 , n);

	double size = 0;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		makeSimpleTube(FDcenterPoints, d+2*size, d+2*size , n);

		p1.set(-l/2, 0, 0);
		makeFlatRing(p1, -vx, d, d+2*size, n);

		p1.set(l/2, 0, 0);
		makeFlatRing(p1, vx, d, d+2*size, n);
	}

// symbols

  // circles
	p.set(-l/2 + sl1, 0, 0);
	FdVector3d normal= -vx;
	makeSymbolicCircle(p, normal, d + 2*size);

	p.set(-l/2 + sl1 + sl2, 0, 0);
	makeSymbolicCircle(p, normal, d + 2*size);

  // ellipses - corrected by PK
	// Assumptions:
	//   - element is smaller than half of ellipse from which will be taken flattened curves

	double dl0 = 50;      // space between center point of ellipse and begining of element
	double dl1 = 0;       // additional space when there is external insulation
	double dl2 = 25;      // space between end of ellipse (longer diameter) and end of the element
	double diam1, diam2;  // diameters

	double alfa, s_ang, e_ang;


	// solving diameters and angles
	alfa = atan(0.5*d/(dl0+dl2+l));  // ellipse slope angle

	dl1 = size/tan(alfa);  // from simillarity of the triangles
	diam1 = d/2 + size;
	diam2 = diam1/sin(alfa);

	s_ang = atan(diam1*sqrt(diam2*diam2-(dl0+dl1)*(dl0+dl1))/(diam2*(dl0+dl1)))*180/M_PI - 1;       // from the eliptical equasion
	e_ang = atan(diam1*sqrt(diam2*diam2-(l+dl0+dl1)*(l+dl0+dl1))/(diam2*(l+dl0+dl1)))*180/M_PI -1;  // from the eliptical equasion

  // TOP HALF OF ELLIPSE
	// points
	FdPoint3d pe1(l/2+dl0+dl1, 0, 0);         // ellipse center point
	FdPoint3d pe2(-l/2-dl2, 0, d/2+size);     // ellipse end point (to longer diameter) - top ellipse
	FdPoint3d pe3(-l/2-dl2, 0, -d/2-size);    // ellipse end point (to longer diameter) - bottom ellipse
	FdPoint3d pe4(l/2+dl0+dl1, d/2+size, 0);  // second ellipse end point (to shorter diameter) - bottom and top ellipse

	// solving vectors
	FdVector3d topUVector(pe1 - pe2);
	FdVector3d botUVector(pe1 - pe3);
	FdVector3d crossVector(pe1 - pe4);

	FdVector3d topNVector = topUVector.crossProduct(crossVector);
	FdVector3d botNVector = botUVector.crossProduct(crossVector);

	// vector normalization
	topNVector.normalize();
	topUVector.normalize();
	botNVector.normalize();
	botUVector.normalize();

	// drawing ellipse - top half
	makeSymbolicEllipse(pe1, topNVector, topUVector, diam2, diam1, 180-s_ang, 180-e_ang);
	makeSymbolicEllipse(pe1, topNVector, topUVector, diam2, diam1, 180+e_ang, 180+s_ang);
	// drawing ellipse - bottom half
	makeSymbolicEllipse(pe1, botNVector, botUVector, diam2, diam1, 180-s_ang, 180-e_ang);
	makeSymbolicEllipse(pe1, botNVector, botUVector, diam2, diam1, 180+e_ang, 180+s_ang);
}

//**********CVAV***********************************************************************************************************
void GLEAccesories::makeSB(double d, double  d0, double  h0, double  d1, double  d2, double  d3, double  d4, double  d5, double  d6, double  d10, double  h, double  h1, double  h2, double  h3, double  h4, double  h5, int n)
{
	// start points
	FdPoint3d p0(0, 0, 0);
	FdPoint3d p1(0, 0, h1 - h2);
	FdPoint3d p2(0, 0, h1);
	FdPoint3d p3(0, 0, h0 - h3 - h4);
	FdPoint3d p4(0, 0, h0 - h5);
	FdPoint3d p5(0, 0, h0 - h4);
	FdPoint3d p6(0, 0, h0);

	// generate gemetry of main tube
	FdPoint3d centTubePoint[5] = {p0, p1, p2, p2, p6};
	double tubeDiam[5][2] = {d, d, d, d, d3, d3, d4, d4, d4, d4};
	FdVector3d normTubeVector[5] = {vz, vz, vz, vz, vz};
	FdVector3d upTubeVector[5] = {vx, vx, vx, vx, vx};

	makeTube(centTubePoint, normTubeVector, upTubeVector, tubeDiam, n, 4, false, true);

	// generate geometry of cone
	FdPoint3d centConvPoint[2] = {p5, p6};
	makeSimpleTube(centConvPoint, d4, 0.01, n);

	// adding rings
	makeFlatRing(p0, vz, d, d2, n);
	makeFlatRing(p1, vz, d, d6, n);
	makeFlatRing(p3, vz, d4, d5, n);
	makeFlatRing(p5, vz, d4, d5, n);

	// connectors
	addCircularConnector(p0);
}





//**********SUC***********************************************************************************************************
void GLEAccesories::makeSUC(double d, double d1, double h, double z, double r, int n)
{
	d1 = d + 20;
	r = h - z;

	FdPoint3d p1(-h / 2, 0, 0);
	FdPoint3d p2( h / 2 ,0, 0);
	FdPoint3d p3(r, 0, 0);

	// center GrillLine
	FdPoint3d pg0(h / 2, 0, -d / 2), pg00(h / 2, 0, d / 2);
	FdPoint3d pg000(h / 2, -d / 2, 0), pg0000(h / 2, d / 2, 0);

	// used for GrillLine right side vertical
	FdPoint3d pg(h / 2, d / 3, 0);
	FdPoint3d pg_(h / 2, d / 4, 0);
	FdPoint3d pg__(h / 2, d / 6, 0);
	FdPoint3d pg___(h / 2, d / 10, 0);

	// used for GrillLine right &left side horizontal
	FdPoint3d pg________(h / 2, 0, d / 3);
	FdPoint3d pg_________(h / 2, 0, d / 4);
	FdPoint3d pg__________(h / 2, 0, d / 6);
	FdPoint3d pg___________(h / 2, 0, d / 10);

	FdPoint3d pg____________(h / 2, 0, -d / 3);
	FdPoint3d pg_____________(h / 2, 0, -d / 4);
	FdPoint3d pg______________(h / 2, 0, -d / 6);
	FdPoint3d pg_______________(h / 2, 0, -d / 10);

	// used for GrillLine left side vertical
	FdPoint3d pg____(h / 2, -d / 3, 0);
	FdPoint3d pg_____(h / 2, -d / 4, 0);
	FdPoint3d pg______(h / 2, -d / 6, 0);
	FdPoint3d pg_______(h / 2, -d / 10, 0);

	// right side vertical
	FdPoint3d pg1(h / 2, d / 3,  sqrt(pow(d / 2, 2) - pow(d / 3,  2))), pg2(h / 2, d / 3,  -sqrt(pow(d / 2, 2) - pow(d / 3,  2)));
	FdPoint3d pg3(h / 2, d / 4,  sqrt(pow(d / 2, 2) - pow(d / 4,  2))), pg4(h / 2, d / 4,  -sqrt(pow(d / 2, 2) - pow(d / 4,  2)));
	FdPoint3d pg5(h / 2, d / 6,  sqrt(pow(d / 2, 2) - pow(d / 6,  2))), pg6(h / 2, d / 6,  -sqrt(pow(d / 2, 2) - pow(d / 6,  2)));
	FdPoint3d pg7(h / 2, d / 10, sqrt(pow(d / 2, 2) - pow(d / 10, 2))), pg8(h / 2, d / 10, -sqrt(pow(d / 2, 2) - pow(d / 10, 2)));

	// left side vertical
	FdPoint3d pg9 (h / 2, -d / 3,  sqrt(pow(d / 2, 2) - pow(d / 3,  2))), pg10(h / 2, -d / 3,  -sqrt(pow(d / 2, 2) - pow(d / 3,  2)));
	FdPoint3d pg11(h / 2, -d / 4,  sqrt(pow(d / 2, 2) - pow(d / 4,  2))), pg12(h / 2, -d / 4,  -sqrt(pow(d / 2, 2) - pow(d / 4,  2)));
	FdPoint3d pg13(h / 2, -d / 6,  sqrt(pow(d / 2, 2) - pow(d / 6,  2))), pg14(h / 2, -d / 6,  -sqrt(pow(d / 2, 2) - pow(d / 6,  2)));
	FdPoint3d pg15(h / 2, -d / 10, sqrt(pow(d / 2, 2) - pow(d / 10, 2))), pg16(h / 2, -d / 10, -sqrt(pow(d / 2, 2) - pow(d / 10, 2)));

	// right & left side horizontal
	FdPoint3d pg17(h / 2, sqrt(pow(d / 2, 2) - pow(d / 3,  2)), d / 3),  pg18(h / 2, -sqrt(pow(d / 2, 2) - pow(d / 3,  2)), d / 3);
	FdPoint3d pg19(h / 2, sqrt(pow(d / 2, 2) - pow(d / 4,  2)), d / 4),  pg20(h / 2, -sqrt(pow(d / 2, 2) - pow(d / 4,  2)), d / 4);
	FdPoint3d pg21(h / 2, sqrt(pow(d / 2, 2) - pow(d / 6,  2)), d / 6),  pg22(h / 2, -sqrt(pow(d / 2, 2) - pow(d / 6,  2)), d / 6);
	FdPoint3d pg23(h / 2, sqrt(pow(d / 2, 2) - pow(d / 10, 2)), d / 10), pg24(h / 2, -sqrt(pow(d / 2, 2) - pow(d / 10, 2)), d / 10);

	FdPoint3d pg25(h / 2, sqrt(pow(d / 2, 2) - pow(d / 3,  2)), -d / 3),  pg26(h / 2, -sqrt(pow(d / 2, 2) - pow(d /3,  2)), -d / 3);
	FdPoint3d pg27(h / 2, sqrt(pow(d / 2, 2) - pow(d / 4,  2)), -d / 4),  pg28(h / 2, -sqrt(pow(d / 2, 2) - pow(d /4,  2)), -d / 4);
	FdPoint3d pg29(h / 2, sqrt(pow(d / 2, 2) - pow(d / 6,  2)), -d / 6),  pg30(h / 2, -sqrt(pow(d / 2, 2) - pow(d /6,  2)), -d / 6);
	FdPoint3d pg31(h / 2, sqrt(pow(d / 2, 2) - pow(d / 10, 2)), -d / 10), pg32(h / 2, -sqrt(pow(d / 2, 2) - pow(d /10, 2)), -d / 10);

	FdVector3d vectorD[2] = { vx, vx };
	FdVector3d vectorUp[2] = { vz, vz };
	FdPoint3d FDcenterPoints[2] = { p1, p2 };
	double diameters[2] = { d, d };

	n = 100;
	makeSimpleTube(FDcenterPoints, d, d, n);

	// adding ring
	makeFlatRing(p3, vx, d, d1, n);

	// grillCircle
	addSymbGrillCircle(vx, p2, vx, d);

	// adding GrillLine right side
	addSymbGrillLine(vz, p2, pg0);
	addSymbGrillLine(vz, p2, pg00);

	addSymbGrillLine(vz, p2, pg000);
	addSymbGrillLine(vz, p2, pg0000);

	addSymbGrillLine(vz, pg, pg1);
	addSymbGrillLine(vz, pg, pg2);

	addSymbGrillLine(vz, pg_, pg3);
	addSymbGrillLine(vz, pg_, pg4);

	addSymbGrillLine(vz, pg__, pg5);
	addSymbGrillLine(vz, pg__, pg6);

	addSymbGrillLine(vz, pg___, pg7);
	addSymbGrillLine(vz, pg___, pg8);

	// left side
	addSymbGrillLine(vz, pg____, pg9);
	addSymbGrillLine(vz, pg____, pg10);

	addSymbGrillLine(vz, pg_____, pg11);
	addSymbGrillLine(vz, pg_____, pg12);

	addSymbGrillLine(vz, pg______, pg13);
	addSymbGrillLine(vz, pg______, pg14);

	addSymbGrillLine(vz, pg_______, pg15);
	addSymbGrillLine(vz, pg_______, pg16);

	addSymbGrillLine(vz, pg________, pg17);
	addSymbGrillLine(vz, pg________, pg18);

	addSymbGrillLine(vz, pg_________, pg19);
	addSymbGrillLine(vz, pg_________, pg20);

	addSymbGrillLine(vz, pg__________, pg21);
	addSymbGrillLine(vz, pg__________, pg22);

	addSymbGrillLine(vz, pg___________, pg23);
	addSymbGrillLine(vz, pg___________, pg24);

	addSymbGrillLine(vz, pg____________, pg25);
	addSymbGrillLine(vz, pg____________, pg26);

	addSymbGrillLine(vz, pg_____________, pg27);
	addSymbGrillLine(vz, pg_____________, pg28);

	addSymbGrillLine(vz, pg______________, pg29);
	addSymbGrillLine(vz, pg______________, pg30);

	addSymbGrillLine(vz, pg_______________, pg31);
	addSymbGrillLine(vz, pg_______________, pg32);
}

//**********OKP***********************************************************************************************************
void GLEAccesories::makeOKP(double a, double b, double d, double g, double l, double l2, int n)
{
	n = 100;

	FdPoint3d rec1(-l2 / 2, 0, 0), rec2(l2 / 2, 0, 0);
	FdPoint3d pt1(-g / 2, 0, 0), pt2(g / 2, 0, 0);

	FdPoint3d recCenterPoint[2] = { rec1, rec2 };
	FdPoint3d tubeCenterPoint[2] = { pt1, pt2 };
	FdVector3d vectorD[2] = { vx, vx };
	FdVector3d Vectorup[2] = { vz, vz };

	double tubePar[3] = { d, d, g };
	double heightWidth[2] = { a, b };

	makeRectToTubeTransition(rec1, vx, vz, heightWidth, rec2, tubePar, n);
}

//**********RDO1***********************************************************************************************************
void GLEAccesories::makeRDO1(double a, double b, double l, double d1, double g, int n)
{
	n = 100;
	g = 25;

	FdPoint3d p1(-l / 2, 0, 0), p2(l / 2, 0, 0);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2]= { a, a };
	makeBox(1, centralPoints, tabWidth, tabHeight, true);

	addRectangularConnector(p1, vx, vy, a + CONNECTOR_SIZE * 2, b + CONNECTOR_SIZE * 2);
	addRectangularConnector(p2, vx, vy, a + CONNECTOR_SIZE * 2, b + CONNECTOR_SIZE * 2);

	double tubPar[3] = { d1, d1, -g };
	makeRectToTubeTransition(p1, vx, vy, tabWidth, p1, tubPar, n);

	// p1.set(-g, 0, 0), p2.set(g, 0, 0);
	// FdPoint3d tubCentralPoints[2] = { p1, p2 };

	// makeVerySimpleTube(tubCentralPoints, d1, n);
	double tubPar2[3] = { d1, d1, g };
	makeRectToTubeTransition(p2, vx, vy, tabWidth, p2, tubPar2, n);


	// add approriate symbol to all four sides
	p1.set(0, 0, b / 2.0);
	makeDampers(p1, vz, vy, a, 5);

	p1.set(0, a / 2.0, 0);
	makeDampers(p1, vy, -vz, b, 5);

	p1.set(0,  0, -b / 2.0);
	makeDampers(p1, -vz, -vy, a, 5);

	p1.set(0, -a / 2.0, 0);
	makeDampers(p1, -vy, vz, b, 5);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1(-l / 2.0, 0, 0), p2(l / 2.0, 0, 0);
		FdPoint3d centralPoints[2] = { p1, p2 };
		FdVector3d v[2] = { vx, vx };
		FdVector3d upv[2] = { vy, vy };
		double tabWidth[2]  = { b + 2 * size, b + 2 * size };
		double tabHeight[2] = { a + 2 * size, a + 2 * size };
		bool sides[4] = { true, true, true, true };
		makeBox(1, centralPoints, v, upv, tabWidth, tabHeight, sides, false, false, (size > CONNECTOR_SIZE) ? 0 : 5, (size > CONNECTOR_SIZE) ? 0 : 5, CONNECTOR_SIZE - size);

		double tubPar[3] = { d1 + 2 * size, d1 + 2 * size, -g };
		makeRectToTubeTransition(p1, vx, vy, tabWidth, p1, tubPar, n);
		p1.set(-l / 2 - g, 0, 0);
		makeFlatRing(p1, vx, d1, d1 + 2 * size, n);

		// p1.set(-g, 0, 0), p2.set(g, 0, 0);
		// FdPoint3d tubCentralPoints[2] = { p1, p2 };

		// makeVerySimpleTube(tubCentralPoints, d1, n);
		double tubPar2[3] = { d1 + 2 * size, d1 + 2 * size, g };
		makeRectToTubeTransition(p2, vx, vy, tabWidth, p2, tubPar2, n);
		p2.set(l / 2 + g, 0, 0);
		makeFlatRing(p2, vx, d1, d1 + 2 * size, n);
	}
}

void GLEAccesories::makeGLE(double d, double a, double b, double c, double d1, double l, int n)
{
	n = 10;

	FdPoint3d p1(-l / 2, 0, 0), p2(l / 2, 0, 0), p3(-l / 2, 0, -d1 / 2), p4(l / 2, 0, -d1 / 2);
	FdPoint3d CentralPoints[2] = { p1, p2 };
	double tabWidth[2] = { c, c };
	double tabHeight[2] = { a, a };
	makeBox(1, CentralPoints, tabWidth, tabHeight, false);

	double tubPar[3] = { d1, d1, 30 };
	double WidthHeight[2] = { a, c };
	makeRectToTubeTransition(p1, vx, vy, WidthHeight, p3, tubPar, n);

	double tubPar2[3] = { d1, d1, -30 };
	makeRectToTubeTransition(p2, vx, vy, WidthHeight, p4, tubPar2, n);
}

///////////////////////////////////////////////END OF GENERAL ACCESORIES FUNCTIONS///////////////////////////////////

#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define AlnorBlockCreator SmkGenBlockCreator

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

/*
// Some useful shortcuts for commonly used vectors.
#define xVec FdVector3d::kXAxis
#define yVec FdVector3d::kYAxis
#define zVec FdVector3d::kZAxis
#define orig FdPoint3d::kOrigin


#define SEGNUM(X) 16
#define RCFlange 45


const int cpx = 10;
const int cpx_lx5 = 5;

const double insSize = 15;
const double boxOffset = 0;
*/

short AlnorBlockCreator::makeFLX_PRO()
{
	ads_real A, B, C, L, A2;
	ads_real d1, d2;
	short n;

	get_val("PBox_D", A);
	get_val("A2", A2);
	get_val("B", B);
	get_val("C", C);
	get_val("L", L);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("n", n);  

	FdPoint3d
		p1(0, 0,  C / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -C / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	// This seems to be wrong... [BP-160630]
	// makeSymbolicCircle(p1, vz, 300);
	// makeSymbolicCircle(p2, vy, 300);

	double tabWidth[] = { B, B };
	double tabHeight[] = { A, A };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);

	p1.set(0, 0, C/2);
	makeSymbolicCircle(p1, vz, d1);
	

	p2.set(0, 0, C / 2 + L);
	makeVerySimpleTube(p1, p2, d1, 4);

	/*
	if (d2 <= 63) A2 = 30;
	else A2 = 45;
	*/

	if (n < 1 || n>3) n = 1;

	p1.set( -B/2  + B /(2*n), A/2, 0);
	p2 = p1 + vy * A2;

	for (int i = 0; i < n; i++)
	{
		makeSymbolicCircle(p1, vy, d2);
		makeVerySimpleTube(p1, p2, d2, 4);

		p1 += (vx * B / n);// dDelta);
		p2 = p1 + vy * A2;
	}

	return 0;
}

short AlnorBlockCreator::makeFLX_PRO_PL()
{
	postTransformMesh(ARX_PI / 2, FdVector3d::kZAxis);

	ads_real A, B, C, L, A2;
	ads_real d1, d2;
	short n;

	get_val("A", A);
	get_val("A2", A2);
	get_val("B", B);
	get_val("PBox_C", C);
	get_val("L", L);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("n", n);

	FdPoint3d
		p1(0, 0, A / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -A / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	double tabWidth[] = { B, B };
	double tabHeight[] = { C, C };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);


	p1.set(0, C / 2, 0);
	makeSymbolicCircle(p1, vy, d1);

	p2.set(0, C / 2 + L, 0);
	makeVerySimpleTube(p1, p2, d1, 4);

	/*
	if (d2 <= 63) A2 = 30;
	else A2 = 45;
	*/

	if (n < 1 || n>3) n = 1;

	p1.set(-B / 2 + B / (2 * n), -C / 2, 0);
	p2 = p1 + -vy * A2;       //p2.set( -B / 4, C / 2, A / 2 + A2);


	for (int i = 0; i < n; i++)
	{
		makeSymbolicCircle(p1, -vy, d2);
		makeVerySimpleTube(p1, p2, d2, 4);

		p1 += (vx * B / n);// dDelta);
		p2 = p1 + -vy * A2;
	}

	return 0;
}


short AlnorBlockCreator::makeFLX_PRO_P()
{

	postTransformMesh(ARX_PI / 2, FdVector3d::kZAxis);

	ads_real A, B, C, L, A2;
	ads_real d1, d2;
	short n;

	get_val("A", B);
	get_val("A2", A2);
	get_val("B", C);
	get_val("PBox_C", A);
	get_val("L", L);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("n", n);

	FdPoint3d
		p1(0, 0, A / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -A / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	double tabWidth[] = { B, B };
	double tabHeight[] = { C, C };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);

	p1.set(0, C / 2, 0);
	makeSymbolicCircle(p1, vy, d1);

	p2.set(0, C / 2 + L, 0);
	makeVerySimpleTube(p1, p2, d1, 4);

	/*
	if ( d2 <= 63) A2 = 30;
	else A2 = 45;
	*/

	if (n < 10 || n>12) n = 10;

	short n2 = n / 2;

	p1.set(-B / 2 + B / (2 * n2), -C / 2, -A/4);
	p2 = p1 + -vy * A2;       //p2.set( -B / 4, C / 2, A / 2 + A2);

	for (int i = 0; i < n2; i++)
	{
		makeSymbolicCircle(p1, -vy, d2);
		makeVerySimpleTube(p1, p2, d2, 4);

		p1 += (vx * B / n2);// dDelta);
		p2 = p1 + -vy * A2;
	}

	p1.set(-B / 2 + B / (2 * n2), -C / 2,  A / 4);
	p2 = p1 + -vy * A2;       //p2.set( -B / 4, C / 2, A / 2 + A2);

	for (int i = 0; i < n2; i++)
	{
		makeSymbolicCircle(p1, -vy, d2);
		makeVerySimpleTube(p1, p2, d2, 4);

		p1 += (vx * B / n2);// dDelta);
		p2 = p1 + -vy * A2 ;
	}

	return 0;
}


short AlnorBlockCreator::makeFLX_PRV_14()
{
	postTransformMesh(ARX_PI / 2, FdVector3d::kXAxis);

	ads_real A, B, C, L, A2;
	ads_real d1, d2;
	short n;

	get_val("PBox_D", A);
	get_val("A2", A2);
	get_val("B", B);
	get_val("C", C);
	get_val("L", L);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("n", n);

	int type = 1;

	char *typ;
	get_val("type", typ);

	if (strstr(typ, "2-2-2-2") != NULL)
		type = 1;
	else
		if (strstr(typ, "2-2-2-0") != NULL)
			type = 2;
		else
			if (strstr(typ, "2-0-2-0") != NULL)
				type = 3;
			else
				if (strstr(typ, "0-2-2-0") != NULL)
					type = 4;
	/*
	if (*pc == L'C')//|| *pc == L'c')
		bResist = TRUE;
	*/

	FdPoint3d
		p1(0, 0, B / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -B / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	double tabWidth[] = { A, A };
	double tabHeight[] = { C, C };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);

	if (d1 > 0)
	{
		p1.set(0, C / 2, 0);
		makeSymbolicCircle(p1, vy, d1);
		p2.set(0, C / 2 + L, 0);
		makeVerySimpleTube(p1, p2, d1, 4);
	}


	

	double dHeightConn = 38;

	double dWidthConnBot = 98;
	double dWidthConnTop = 48;
	double dWidthPanel = 6.85;

	double dWidthPanel2 = 26.25;

	FdVector3d mv = vy;
	FdVector3d mvU = vz;
	FdVector3d mvShift = vx;

	double rangl = M_PI * (-360.0 / 14.0) / 180.0;

	FdPoint3d cpCon( -A/4, 0, B/2 + A2/2);

	double dWidthShift = A;
	double dHeightShift = B;
	
	for (int n = 0; n < 2; n++)
	{
		for (int m = 0; m < 2; m++)
		{
			if (n == 1 && m == 1 && type == 2) return 0;

			if ( m == 1 && type == 4) continue;
			/*
			if (n == 0 && m == 0 && type == 4)
			{
				cpCon -= mvU * (dHeightShift + dHeightConn);
				continue;
			}
			*/

			for (int k = 0; k < 2; k++)
			{
				
				cp[0] = cpCon - mv * dHeightConn / 2;
				cp[1] = cpCon - mv * dHeightConn / 2;
				sides[0] = true;
				v[0] = v[1] = mv;
				vU[0] = vU[1] = mvU;
				tabHeight[0] = tabHeight[1] = A2;
				tabWidth[0] = tabWidth[1] = dWidthConnBot;

				makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

				cp[0] = cpCon + mv * dHeightConn / 2;
				cp[1] = cpCon + mv * dHeightConn / 2;
				tabWidth[0] = tabWidth[1] = dWidthConnTop;

				makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

				p1 = cpCon - mv * (dHeightConn / 2 - 15) - mvShift * 45.6;
				cp[0] = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;
				cp[1] = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;
				tabWidth[0] = tabWidth[1] = dWidthPanel;

				rangl = M_PI * (-360.0 / 14.0) / 180.0;

				for (int i = 0; i < 6; i++)
				{
					cp[0].rotateBy(rangl, mvU, p1);
					cp[1].rotateBy(rangl, mvU, p1);
					v[0] = v[0].rotateBy(rangl, mvU);
					v[1] = v[1].rotateBy(rangl, mvU);
					makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
				}

				cp[0].rotateBy(rangl / 2, mvU, p1);
				cp[1].rotateBy(rangl / 2, mvU, p1);
				v[0] = v[0].rotateBy(rangl / 2, mvU);
				v[1] = v[1].rotateBy(rangl / 2, mvU);

				cp[0] += v[0] * -0.4;
				cp[1] += v[0] * -0.4;

				rangl = M_PI * (4.8) / 180.0;
				v[0] = v[0].rotateBy(rangl, mvU);
				v[1] = v[1].rotateBy(rangl, mvU);

				p2 = cpCon + mv * dHeightConn / 2 - mvShift * dWidthConnTop / 2;
				FdVector3d nv(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
				double lenv = nv.length();
				nv.normalize();
				cp[0] -= nv * lenv / 2;
				cp[1] -= nv * lenv / 2;

				tabWidth[0] = tabWidth[1] = dWidthPanel2;

				makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);



				p1 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
				cp[0] = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;
				cp[1] = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;
				v[0] = v[1] = mv;
				tabWidth[0] = tabWidth[1] = dWidthPanel;

				rangl = M_PI * (360.0 / 14.0) / 180.0;

				for (int i = 0; i < 6; i++)
				{
					cp[0].rotateBy(rangl, mvU, p1);
					cp[1].rotateBy(rangl, mvU, p1);
					v[0] = v[0].rotateBy(rangl, mvU);
					v[1] = v[1].rotateBy(rangl, mvU);
					makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
				}

				cp[0].rotateBy(rangl / 2, mvU, p1);
				cp[1].rotateBy(rangl / 2, mvU, p1);
				v[0] = v[0].rotateBy(rangl / 2, mvU);
				v[1] = v[1].rotateBy(rangl / 2, mvU);

				cp[0] += v[0] * -0.4;
				cp[1] += v[0] * -0.4;

				rangl = M_PI * (-4.8) / 180.0;
				v[0] = v[0].rotateBy(rangl, mvU);
				v[1] = v[1].rotateBy(rangl, mvU);

				p2 = cpCon + mv * dHeightConn / 2 + mvShift * dWidthConnTop / 2;
				nv.set(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
				lenv = nv.length();
				nv.normalize();
				cp[0] -= nv * lenv / 2;
				cp[1] -= nv * lenv / 2;
				tabWidth[0] = tabWidth[1] = dWidthPanel2;

				makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

				// Move point to 2th connector on one side
				//******
				cpCon += mvShift * dWidthShift / 2;
				//*****
			}

			// It moves point  on the opposite side 
			//*******
			cpCon -= mvShift * dWidthShift;
			cpCon -= mvU * (dHeightShift + A2);// dHeightConn );
			//*******
			
		}
		
		if (type == 3) return 0;

		// Set start point on left-side.  Then it will moves point from left to right 
		//*********		
		mvU = -vx;
		mvShift = vz;

		cpCon.set( -A / 2 - A2 / 2, 0, -B / 4 );

		dWidthShift = B;
		dHeightShift = A;
		//*********

	}

	return 0;
}

short AlnorBlockCreator::makeFLX_PRV_11()  // the olden days
{

	postTransformMesh(ARX_PI / 2, FdVector3d::kXAxis);


	double dWidthPanel2 = 26.25;


	ads_real A, B, C, L, A2;
	ads_real d1, d2;
	short n;

	get_val("PBox_D", A);
	get_val("A2", A2);
	get_val("B", B);
	get_val("C", C);
	get_val("L", L);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("n", n);

	A2 = 40;

	FdPoint3d
		p1(0, 0, A / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -A / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	double tabWidth[] = { B, B };
	double tabHeight[] = { C, C };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);

	p1.set(0, C / 2, 0);
	makeSymbolicCircle(p1, vy, d1);
	p2.set(0, C / 2 + L, 0);
	makeVerySimpleTube(p1, p2, d1, 4);



	//   Front/bottom  connector 
	cp[0].set(0, 0 - 38 / 2, A / 2 + A2 / 2);
	cp[1].set(0, 0 - 38 / 2, A / 2 + A2 / 2);
	sides[0] = true;
	v[0] = v[1] = vy;
	vU[0] = vU[1] = vz;
	tabHeight[0] = tabHeight[1] = A2;
	tabWidth[0] = tabWidth[1] = 98;

	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);


	cp[0].set(0, 0 + 38 / 2, A / 2 + A2 / 2);
	cp[1].set(0, 0 + 38 / 2, A / 2 + A2 / 2);

	tabWidth[0] = tabWidth[1] = 48;

	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	v[0] = v[1] = vy;
	vU[0] = vU[1] = vx;

	tabHeight[0] = tabHeight[1] = 6.85;
	tabWidth[0] = tabWidth[1] = A2;

	p1.set(    -45.6, -38 / 2 + 15, A / 2);
	cp[0].set( -45.6, -38 / 2, A / 2 + A2 / 2);
	cp[1].set( -45.6, -38 / 2, A / 2 + A2 / 2);

	double rangl = M_PI * (-360.0 / 14.0) / 180.0;

	for (int i = 0; i < 6; i++)
	{
		//makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0].rotateBy(rangl, vz, p1);
		cp[1].rotateBy(rangl, vz, p1);
		vU[0] = vU[0].rotateBy(rangl, vz);
		vU[1] = vU[1].rotateBy(rangl, vz);
		v[0] = v[0].rotateBy(rangl, vz);
		v[1] = v[1].rotateBy(rangl, vz);
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}


	cp[0].rotateBy(rangl/2, vz, p1);
	cp[1].rotateBy(rangl/2, vz, p1);
	v[0] = v[0].rotateBy(rangl/2, vz);
	v[1] = v[1].rotateBy(rangl/2, vz);

	cp[0] += v[0] * -0.4;
	cp[1] += v[0] * -0.4;


	rangl = M_PI * (-8.0) / 180.0;

	vU[0] = vU[0].rotateBy(rangl, vz);
	vU[1] = vU[1].rotateBy(rangl, vz);
	tabHeight[0] = tabHeight[1] = dWidthPanel2;
	
	//FdVector3d nVm = vU[0].rotateBy(  M_PI/-2.0, vz);
	cp[1].x -= (cp[0].x + 48 / 2) / 2;
	cp[1].y += (38 / 2 - cp[0].y) / 2;
	cp[0].set(cp[1].x, cp[1].y, cp[1].z);
	
	//FdVector3d	nVU( )

	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);



	tabHeight[0] = tabHeight[1] = 6.85;
	vU[0] = vU[1] = vx;

	p1.set(    45.6, -38 / 2 + 15, A / 2);
	cp[0].set( 45.6, -38 / 2, A / 2 + A2 / 2);
	cp[1].set( 45.6, -38 / 2, A / 2 + A2 / 2);

	rangl = M_PI * (360.0 / 14.0) / 180.0;

	for (int i = 0; i < 6; i++)
	{
		//makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0].rotateBy(rangl, vz, p1);
		cp[1].rotateBy(rangl, vz, p1);
		vU[0] = vU[0].rotateBy(rangl, vz);
		vU[1] = vU[1].rotateBy(rangl, vz);
		v[0] = v[0].rotateBy(rangl, vz);
		v[1] = v[1].rotateBy(rangl, vz);
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}


	cp[0].rotateBy(rangl / 2, vz, p1);
	cp[1].rotateBy(rangl / 2, vz, p1);
	v[0] = v[0].rotateBy(rangl / 2, vz);
	v[1] = v[1].rotateBy(rangl / 2, vz);

	cp[0] += v[0] * 0.4;
	cp[1] += v[0] * 0.4;


	rangl = M_PI * ( 8.0) / 180.0;

	vU[0] = vU[0].rotateBy(rangl, vz);
	vU[1] = vU[1].rotateBy(rangl, vz);
	tabHeight[0] = tabHeight[1] = dWidthPanel2;

	cp[1].x -= (cp[0].x - 48 / 2) / 2;
	cp[1].y += (38 / 2 - cp[0].y) / 2;
	cp[0].set(cp[1].x, cp[1].y, cp[1].z);

	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);


	//   Back/top  connector 
	if (n > 1)
	{

		cp[0].set(0, 0 - 38 / 2, -A / 2 - A2 / 2);
		cp[1].set(0, 0 - 38 / 2, -A / 2 - A2 / 2);
		v[0] = v[1] = vy;
		vU[0] = vU[1] = vz;
		tabHeight[0] = tabHeight[1] = A2;
		tabWidth[0] = tabWidth[1] = 98;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		cp[0].set(0, 0 + 38 / 2, -A / 2 - A2 / 2);
		cp[1].set(0, 0 + 38 / 2, -A / 2 - A2 / 2);

		tabWidth[0] = tabWidth[1] = 48;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		v[0] = v[1] = vy;
		vU[0] = vU[1] = vx;

		tabHeight[0] = tabHeight[1] = 6.85;
		tabWidth[0] = tabWidth[1] = A2;

		p1.set(-45.6, -38 / 2 + 15, -A / 2);
		cp[0].set(-45.6, -38 / 2, -A / 2 - A2 / 2);
		cp[1].set(-45.6, -38 / 2, -A / 2 - A2 / 2);

		rangl = M_PI * (-360.0 / 14.0) / 180.0;

		for (int i = 0; i < 6; i++)
		{
			//makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
			cp[0].rotateBy(rangl, vz, p1);
			cp[1].rotateBy(rangl, vz, p1);
			vU[0] = vU[0].rotateBy(rangl, vz);
			vU[1] = vU[1].rotateBy(rangl, vz);
			v[0] = v[0].rotateBy(rangl, vz);
			v[1] = v[1].rotateBy(rangl, vz);
			makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		}


		cp[0].rotateBy(rangl / 2, vz, p1);
		cp[1].rotateBy(rangl / 2, vz, p1);
		v[0] = v[0].rotateBy(rangl / 2, vz);
		v[1] = v[1].rotateBy(rangl / 2, vz);

		cp[0] += v[0] * -0.4;
		cp[1] += v[0] * -0.4;


		rangl = M_PI * (-8.0) / 180.0;

		vU[0] = vU[0].rotateBy(rangl, vz);
		vU[1] = vU[1].rotateBy(rangl, vz);
		tabHeight[0] = tabHeight[1] = dWidthPanel2;

		//FdVector3d nVm = vU[0].rotateBy(  M_PI/-2.0, vz);
		cp[1].x -= (cp[0].x + 48 / 2) / 2;
		cp[1].y += (38 / 2 - cp[0].y) / 2;
		cp[0].set(cp[1].x, cp[1].y, cp[1].z);

		//FdVector3d	nVU( )

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);



		tabHeight[0] = tabHeight[1] = 6.85;
		vU[0] = vU[1] = vx;

		p1.set(45.6, -38 / 2 + 15, -A / 2);
		cp[0].set(45.6, -38 / 2, -A / 2 - A2 / 2);
		cp[1].set(45.6, -38 / 2, -A / 2 - A2 / 2);

		rangl = M_PI * (360.0 / 14.0) / 180.0;

		for (int i = 0; i < 6; i++)
		{
			//makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
			cp[0].rotateBy(rangl, vz, p1);
			cp[1].rotateBy(rangl, vz, p1);
			vU[0] = vU[0].rotateBy(rangl, vz);
			vU[1] = vU[1].rotateBy(rangl, vz);
			v[0] = v[0].rotateBy(rangl, vz);
			v[1] = v[1].rotateBy(rangl, vz);
			makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		}


		cp[0].rotateBy(rangl / 2, vz, p1);
		cp[1].rotateBy(rangl / 2, vz, p1);
		v[0] = v[0].rotateBy(rangl / 2, vz);
		v[1] = v[1].rotateBy(rangl / 2, vz);

		cp[0] += v[0] * 0.4;
		cp[1] += v[0] * 0.4;


		rangl = M_PI * (8.0) / 180.0;

		vU[0] = vU[0].rotateBy(rangl, vz);
		vU[1] = vU[1].rotateBy(rangl, vz);
		tabHeight[0] = tabHeight[1] = dWidthPanel2;

		//FdVector3d nVm = vU[0].rotateBy(  M_PI/-2.0, vz);
		cp[1].x -= (cp[0].x - 48 / 2) / 2;
		cp[1].y += (38 / 2 - cp[0].y) / 2;
		cp[0].set(cp[1].x, cp[1].y, cp[1].z);

		//FdVector3d	nVU( )

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}


	return 0;
}


short AlnorBlockCreator::makeFLX_VNS()
{
	//postTransformMesh(ARX_PI / 2, FdVector3d::kXAxis);

	ads_real a, b, L;

	get_val("a", a);
	get_val("b", b);
	get_val("L", L);


	double dHeightConn = b;

	double dWidthConnBot = 98;
	double dWidthConnTop = 48;
	double dWidthPanel = 6.85;

	double dWidthPanel2 = 26.25;


	FdVector3d mv = vz;// vy;
	FdVector3d mvU = -vx;// vz;
	FdVector3d mvShift = vy; // vx;

	double rangl = M_PI * (-360.0 / 14.0) / 180.0;

	FdPoint3d cpCon( 0, 0, 0);

	FdPoint3d
		p1(0, 0, 0),
		p2(0, 0, 0);
		

	FdPoint3d cp[] = {  cpCon, cpCon };

	double tabWidth[] = { dWidthConnBot, dWidthConnBot };
	double tabHeight[] = { L, L };
	bool sides[] = { true, true, true, true };
	FdVector3d v[] = { mv, mv };
	FdVector3d vU[] = { mvU, mvU };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};



	cp[0] = cpCon - mv * dHeightConn / 2;
	cp[1] = cpCon - mv * dHeightConn / 2;

	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	cp[0] = cpCon + mv * dHeightConn / 2;
	cp[1] = cpCon + mv * dHeightConn / 2;
	tabWidth[0] = tabWidth[1] = dWidthConnTop;

	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	p1 = cpCon - mv * (dHeightConn / 2 - 15) - mvShift * 45.6;
	cp[0] = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;
	cp[1] = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;
	tabWidth[0] = tabWidth[1] = dWidthPanel;

	rangl = M_PI * ( 360.0 / 14.0) / 180.0;

	for (int i = 0; i < 6; i++)
	{
		cp[0].rotateBy(rangl, mvU, p1);
		cp[1].rotateBy(rangl, mvU, p1);
		v[0] = v[0].rotateBy(rangl, mvU);
		v[1] = v[1].rotateBy(rangl, mvU);
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}

	cp[0].rotateBy(rangl / 2, mvU, p1);
	cp[1].rotateBy(rangl / 2, mvU, p1);
	v[0] = v[0].rotateBy(rangl / 2, mvU);
	v[1] = v[1].rotateBy(rangl / 2, mvU);

	cp[0] += v[0] * -0.4;
	cp[1] += v[0] * -0.4;

	rangl = M_PI * (-4.8) / 180.0;
	v[0] = v[0].rotateBy(rangl, mvU);
	v[1] = v[1].rotateBy(rangl, mvU);

	p2 = cpCon + mv * dHeightConn / 2 - mvShift * dWidthConnTop / 2;
	FdVector3d nv(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
	double lenv = nv.length();
	nv.normalize();
	cp[0] -= nv * lenv / 2;
	cp[1] -= nv * lenv / 2;

	tabWidth[0] = tabWidth[1] = dWidthPanel2;

	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);



	p1 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
	cp[0] = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;
	cp[1] = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;
	v[0] = v[1] = mv;
	tabWidth[0] = tabWidth[1] = dWidthPanel;

	rangl = M_PI * ( -360.0 / 14.0) / 180.0;

	for (int i = 0; i < 6; i++)
	{
		cp[0].rotateBy(rangl, mvU, p1);
		cp[1].rotateBy(rangl, mvU, p1);
		v[0] = v[0].rotateBy(rangl, mvU);
		v[1] = v[1].rotateBy(rangl, mvU);
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}

	cp[0].rotateBy(rangl / 2, mvU, p1);
	cp[1].rotateBy(rangl / 2, mvU, p1);
	v[0] = v[0].rotateBy(rangl / 2, mvU);
	v[1] = v[1].rotateBy(rangl / 2, mvU);

	cp[0] += v[0] * -0.4;
	cp[1] += v[0] * -0.4;

	rangl = M_PI * (4.8) / 180.0;
	v[0] = v[0].rotateBy(rangl, mvU);
	v[1] = v[1].rotateBy(rangl, mvU);

	p2 = cpCon + mv * dHeightConn / 2 + mvShift * dWidthConnTop / 2;
	nv.set(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
	lenv = nv.length();
	nv.normalize();
	cp[0] -= nv * lenv / 2;
	cp[1] -= nv * lenv / 2;
	tabWidth[0] = tabWidth[1] = dWidthPanel2;

	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);


	return 0;
}


short AlnorBlockCreator::makeFLX_VBH()
{

	ads_real a, b, L;

	get_val("a", a);
	get_val("b", b);
	//get_val("L", L);

	L = 52;

	double dHeightConn = b;

	double dWidthConnBot = 98;
	double dWidthConnTop = 48;
	double dWidthPanel = 6.85;

	double dWidthPanel2 = 26.25;

	FdVector3d mv = vz; // vz;// vy;
	FdVector3d mvU = vy; // -vx;// vz;
	FdVector3d mvShift = vx; // vy; // vx;

	double rangl = M_PI * (-360.0 / 14.0) / 180.0;

	FdPoint3d cpCon(0, 0, 0);

	FdPoint3d
		p1(0, 0, 0),
		p2(0, 0, 0);


	FdPoint3d cp[] = { cpCon, cpCon };

	double tabWidth[] = { dWidthConnBot, dWidthConnBot };
	double tabHeight[] = { L, L };
	bool sides[] = { true, true, true, true };
	FdVector3d v[] = { mv, mv };
	FdVector3d vU[] = { mvU, mvU };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};

	cpCon = cpCon - a / 2 * mvU - L / 2 * mvU;

	for (int i = 0; i < 2; i++)
	{
		v[0] = v[1] = mv;
		vU[0] = vU[1] = mvU;

		cp[0] = cpCon - mv * dHeightConn / 2;
		cp[1] = cpCon - mv * dHeightConn / 2;
		tabWidth[0] = tabWidth[1] = dWidthConnBot;
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		cp[0] = cpCon + mv * dHeightConn / 2;
		cp[1] = cpCon + mv * dHeightConn / 2;
		tabWidth[0] = tabWidth[1] = dWidthConnTop;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		p1 = cpCon - mv * (dHeightConn / 2 - 15) - mvShift * 45.6;
		cp[0] = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;
		cp[1] = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;
		tabWidth[0] = tabWidth[1] = dWidthPanel;

		rangl = M_PI * (360.0 / 14.0) / 180.0;

		for (int i = 0; i < 6; i++)
		{
			cp[0].rotateBy(rangl, mvU, p1);
			cp[1].rotateBy(rangl, mvU, p1);
			v[0] = v[0].rotateBy(rangl, mvU);
			v[1] = v[1].rotateBy(rangl, mvU);
			makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		}

		cp[0].rotateBy(rangl / 2, mvU, p1);
		cp[1].rotateBy(rangl / 2, mvU, p1);
		v[0] = v[0].rotateBy(rangl / 2, mvU);
		v[1] = v[1].rotateBy(rangl / 2, mvU);

		cp[0] += v[0] * -0.4;
		cp[1] += v[0] * -0.4;

		rangl = M_PI * (-4.8) / 180.0;
		v[0] = v[0].rotateBy(rangl, mvU);
		v[1] = v[1].rotateBy(rangl, mvU);

		p2 = cpCon + mv * dHeightConn / 2 - mvShift * dWidthConnTop / 2;
		FdVector3d nv(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
		double lenv = nv.length();
		nv.normalize();
		cp[0] -= nv * lenv / 2;
		cp[1] -= nv * lenv / 2;

		tabWidth[0] = tabWidth[1] = dWidthPanel2;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);



		p1 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
		cp[0] = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;
		cp[1] = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;
		v[0] = v[1] = mv;
		tabWidth[0] = tabWidth[1] = dWidthPanel;

		rangl = M_PI * (-360.0 / 14.0) / 180.0;

		for (int i = 0; i < 6; i++)
		{
			cp[0].rotateBy(rangl, mvU, p1);
			cp[1].rotateBy(rangl, mvU, p1);
			v[0] = v[0].rotateBy(rangl, mvU);
			v[1] = v[1].rotateBy(rangl, mvU);
			makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		}

		cp[0].rotateBy(rangl / 2, mvU, p1);
		cp[1].rotateBy(rangl / 2, mvU, p1);
		v[0] = v[0].rotateBy(rangl / 2, mvU);
		v[1] = v[1].rotateBy(rangl / 2, mvU);

		cp[0] += v[0] * -0.4;
		cp[1] += v[0] * -0.4;

		rangl = M_PI * (4.8) / 180.0;
		v[0] = v[0].rotateBy(rangl, mvU);
		v[1] = v[1].rotateBy(rangl, mvU);

		p2 = cpCon + mv * dHeightConn / 2 + mvShift * dWidthConnTop / 2;
		nv.set(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
		lenv = nv.length();
		nv.normalize();
		cp[0] -= nv * lenv / 2;
		cp[1] -= nv * lenv / 2;
		tabWidth[0] = tabWidth[1] = dWidthPanel2;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		cpCon.set(0, 0, 0);
		cpCon = cpCon + a / 2 * mvShift + L / 2 * mvShift;

		mv = vz;// vz; // vy;
		mvU = -vx;// vy;// -vx;
		mvShift = vy; // vx; // vz;
	}






	mv = vz;// vy;
	mvU = vy; // vz;
	mvShift = vx; // vx;
	//v[0] = v[1] = mv;
	//vU[0] = vU[1] = mvU;

	cpCon.set(0, 0, 0);
	cpCon = cpCon - a / 2 * mvU; // +L / 2 * mvU;

	p1 = cpCon - mv * (dHeightConn / 2 - 15) - mvShift * 45.6;
	FdPoint3d pStart = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;

	FdVector3d vU_St = mv;
	FdVector3d v_St = -mvU;

	p2 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * a /2;


	rangl = M_PI * (360.0 / 14.0) / 180.0;
	double rangl2 = M_PI * (-360.0 / 12.0) / 180.0;

	for (int i = 0; i < 6; i++)
	{
		pStart.rotateBy(rangl, mvU, p1);
		vU_St.rotateBy(rangl, mvU);

		//p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];

		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mv, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mv);
			v[j] = v_tmp.rotateBy(rangl2, mv);

		}
		double tabWidth[] = { dWidthPanel, dWidthPanel, dWidthPanel, dWidthPanel };
		double tabHeight[] = { 0.01, 0.01, 0.01, 0.01 };
		bool sides[] = { true, false, false, false, true, false, false, false, true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}

	

	pStart.rotateBy(rangl / 2, mvU, p1);
	vU_St.rotateBy(rangl / 2, mvU);

	pStart += vU_St * -0.4;

	rangl = M_PI * (-4.8) / 180.0;
	vU_St.rotateBy(rangl, mvU);

	FdPoint3d   pp2 = cpCon + mv * dHeightConn / 2 - mvShift * dWidthConnTop / 2;
	FdVector3d nv(pStart.x - pp2.x, pStart.y - pp2.y, pStart.z - pp2.z);
	double lenv = nv.length();
	nv.normalize();
	pStart -= nv * lenv / 2;


	for (int i = 0; i < 1; i++)
	{
		//pStart.rotateBy(rangl, mvU, p1);
		//vU_St.rotateBy(rangl, mvU);

		//p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];

		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mv, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mv);
			v[j] = v_tmp.rotateBy(rangl2, mv);

		}
		double tabWidth[] = { dWidthPanel2, dWidthPanel2, dWidthPanel2, dWidthPanel2 };
		double tabHeight[] = { 0.01, 0.01, 0.01, 0.01 };
		bool sides[] = { true, false, false, false, true, false, false, false, true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}





	cpCon.set(0, 0, 0);
	cpCon = cpCon - a / 2 * mvU;  // +L / 2 * mvU;

	p1 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
	pStart = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;

	vU_St = mv;
	v_St = -mvU;

	p2 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * a / 2;

	rangl = M_PI * (-360.0 / 14.0) / 180.0;
	rangl2 = M_PI * (-360.0 / 12.0) / 180.0;

	for (int i = 0; i < 6; i++)
	{
		pStart.rotateBy(rangl, mvU, p1);
		vU_St.rotateBy(rangl, mvU);

		//p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];

		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mv, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mv);
			v[j] = v_tmp.rotateBy(rangl2, mv);

		}
		double tabWidth[] = { dWidthPanel, dWidthPanel, dWidthPanel, dWidthPanel };
		double tabHeight[] = { 0.01, 0.01, 0.01, 0.01 };
		bool sides[] = { true, false, false, false, true, false, false, false, true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}

	pStart.rotateBy(rangl / 2, mvU, p1);
	vU_St.rotateBy(rangl / 2, mvU);

	pStart += vU_St * -0.4;

	rangl = M_PI * (4.8) / 180.0;
	vU_St.rotateBy(rangl, mvU);

	pp2 = cpCon + mv * dHeightConn / 2 + mvShift * dWidthConnTop / 2;
	nv.set(pStart.x - pp2.x, pStart.y - pp2.y, pStart.z - pp2.z);
	lenv = nv.length();
	nv.normalize();
	pStart -= nv * lenv / 2;


	for (int i = 0; i < 1; i++)
	{
		//pStart.rotateBy(rangl, mvU, p1);
		//vU_St.rotateBy(rangl, mvU);

		//p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];

		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mv, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mv);
			v[j] = v_tmp.rotateBy(rangl2, mv);

		}
		double tabWidth[] = { dWidthPanel2, dWidthPanel2, dWidthPanel2, dWidthPanel2 };
		double tabHeight[] = { 0.01, 0.01, 0.01, 0.01 };
		bool sides[] = { true, false, false, false, true, false, false, false, true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}


	cpCon.set(0, 0, 0);
	cpCon = cpCon - a / 2 * mvU; // +L / 2 * mvU;

	//p1 = cpCon + mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
	pStart = cpCon - mv * dHeightConn / 2;// +mvShift * 45.6;

	vU_St = mv;
	v_St = -mvU;

	p2 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * a / 2;

	//tabWidth[0] = tabWidth[1] = dWidthPanel;

	rangl = M_PI * (360.0 / 14.0) / 180.0;
	rangl2 = M_PI * (-360.0 / 12.0) / 180.0;

	for (int i = 0; i < 1; i++)
	{
		//pStart.rotateBy(rangl, mvU, p1);
		//vU_St.rotateBy(rangl, mvU);

		//p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];

		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mv, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mv);
			v[j] = v_tmp.rotateBy(rangl2, mv);

		}
		double tabWidth[] = { dWidthConnBot, dWidthConnBot, dWidthConnBot, dWidthConnBot };
		double tabHeight[] = { 0.01, 0.01, 0.01, 0.01 };
		bool sides[] = { true, false, false, false, true, false, false, false, true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}



	cpCon.set(0, 0, 0);
	cpCon = cpCon - a / 2 * mvU; // +L / 2 * mvU;

	//p1 = cpCon + mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
	pStart = cpCon + mv * dHeightConn / 2;// +mvShift * 45.6;

	vU_St = mv;
	v_St = -mvU;

	p2 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * a / 2;

	//tabWidth[0] = tabWidth[1] = dWidthPanel;

	rangl = M_PI * (360.0 / 14.0) / 180.0;
	rangl2 = M_PI * (-360.0 / 12.0) / 180.0;

	for (int i = 0; i < 1; i++)
	{
		//pStart.rotateBy(rangl, mvU, p1);
		//vU_St.rotateBy(rangl, mvU);

		//p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];

		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mv, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mv);
			v[j] = v_tmp.rotateBy(rangl2, mv);

		}
		double tabWidth[] = { dWidthConnTop, dWidthConnTop, dWidthConnTop, dWidthConnTop };
		double tabHeight[] = { 0.01, 0.01, 0.01, 0.01 };
		bool sides[] = { true, false, false, false, true, false, false, false, true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}



	return 0;
}
short AlnorBlockCreator::makeFLX_VBW()
{

	ads_real a, b, L;

	get_val("a", a);
	get_val("b", b);
	//get_val("L", L);

	L = 47;

	double dHeightConn = b;

	double dWidthConnBot = 98;
	double dWidthConnTop = 48;
	double dWidthPanel = 6.85;
	
	double dWidthPanel2 = 26.25;

	FdVector3d mv = vy;
	FdVector3d mvU = vz;
	FdVector3d mvShift = vx;

	double rangl = M_PI * (-360.0 / 14.0) / 180.0;

	FdPoint3d cpCon(0, 0, 0);

	FdPoint3d
		p1(0, 0, 0),
		p2(0, 0, 0);


	FdPoint3d cp[] = { cpCon, cpCon };

	double tabWidth[] = { dWidthConnBot, dWidthConnBot };
	double tabHeight[] = { L, L };
	bool sides[] = { true, true, true, true };
	FdVector3d v[] = { mv, mv };
	FdVector3d vU[] = { mvU, mvU };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};

	cpCon = cpCon + b / 2 * mvU + L / 2 * mvU;

	for (int i = 0; i < 2; i++)
	{
		v[0] = v[1] = mv;
		vU[0] = vU[1] = mvU;

		cp[0] = cpCon - mv * dHeightConn / 2;
		cp[1] = cpCon - mv * dHeightConn / 2;
		tabWidth[0] = tabWidth[1] = dWidthConnBot;
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		cp[0] = cpCon + mv * dHeightConn / 2;
		cp[1] = cpCon + mv * dHeightConn / 2;
		tabWidth[0] = tabWidth[1] = dWidthConnTop;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		p1 = cpCon - mv * (dHeightConn / 2 - 15) - mvShift * 45.6;
		cp[0] = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;
		cp[1] = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;
		tabWidth[0] = tabWidth[1] = dWidthPanel;

		rangl = M_PI * (-360.0 / 14.0) / 180.0;

		for (int i = 0; i < 6; i++)
		{
			cp[0].rotateBy(rangl, mvU, p1);
			cp[1].rotateBy(rangl, mvU, p1);
			v[0] = v[0].rotateBy(rangl, mvU);
			v[1] = v[1].rotateBy(rangl, mvU);
			makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		}

		cp[0].rotateBy(rangl / 2, mvU, p1);
		cp[1].rotateBy(rangl / 2, mvU, p1);
		v[0] = v[0].rotateBy(rangl / 2, mvU);
		v[1] = v[1].rotateBy(rangl / 2, mvU);

		cp[0] += v[0] * -0.4;
		cp[1] += v[0] * -0.4;

		rangl = M_PI * (4.8) / 180.0;
		v[0] = v[0].rotateBy(rangl, mvU);
		v[1] = v[1].rotateBy(rangl, mvU);

		p2 = cpCon + mv * dHeightConn / 2 - mvShift * dWidthConnTop / 2;
		FdVector3d nv(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
		double lenv = nv.length();
		nv.normalize();
		cp[0] -= nv * lenv / 2;
		cp[1] -= nv * lenv / 2;

		tabWidth[0] = tabWidth[1] = dWidthPanel2;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);



		p1 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
		cp[0] = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;
		cp[1] = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;
		v[0] = v[1] = mv;
		tabWidth[0] = tabWidth[1] = dWidthPanel;

		rangl = M_PI * (360.0 / 14.0) / 180.0;

		for (int i = 0; i < 6; i++)
		{
			cp[0].rotateBy(rangl, mvU, p1);
			cp[1].rotateBy(rangl, mvU, p1);
			v[0] = v[0].rotateBy(rangl, mvU);
			v[1] = v[1].rotateBy(rangl, mvU);
			makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		}

		cp[0].rotateBy(rangl / 2, mvU, p1);
		cp[1].rotateBy(rangl / 2, mvU, p1);
		v[0] = v[0].rotateBy(rangl / 2, mvU);
		v[1] = v[1].rotateBy(rangl / 2, mvU);

		cp[0] += v[0] * -0.4;
		cp[1] += v[0] * -0.4;

		rangl = M_PI * (-4.8) / 180.0;
		v[0] = v[0].rotateBy(rangl, mvU);
		v[1] = v[1].rotateBy(rangl, mvU);

		p2 = cpCon + mv * dHeightConn / 2 + mvShift * dWidthConnTop / 2;
		nv.set(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
		lenv = nv.length();
		nv.normalize();
		cp[0] -= nv * lenv / 2;
		cp[1] -= nv * lenv / 2;
		tabWidth[0] = tabWidth[1] = dWidthPanel2;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		
		cpCon = cpCon - L / 2 * mvU - b / 2 * mvU + b / 2 * mv + L / 2 * mv;

		mv = vz;
		mvU = -vy;
	}

	mv = vy;
	mvU = vz;
	//v[0] = v[1] = mv;
	//vU[0] = vU[1] = mvU;

	cpCon.set(0, 0, 0);
	cpCon = cpCon + b / 2 * mvU; // +L / 2 * mvU;

	p1 = cpCon - mv * (dHeightConn / 2 - 15) - mvShift * 45.6;
	FdPoint3d pStart = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;

	FdVector3d vU_St = mv;
	FdVector3d v_St = -mvU;

	p2 = cpCon + mv * dHeightConn / 2 - mvShift * 45.6;

	//tabWidth[0] = tabWidth[1] = dWidthPanel;

	rangl = M_PI * (-360.0 / 14.0) / 180.0;
	double rangl2 = M_PI * (360.0 / 12.0) / 180.0;

	for (int i = 0; i < 6; i++)
	{
		pStart.rotateBy(rangl, mvU, p1);
		vU_St.rotateBy(rangl, mvU);

		p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];
		
		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mvShift, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mvShift);
			v[j]  =  v_tmp.rotateBy(rangl2, mvShift);

		}
		double tabWidth[] = { dWidthPanel, dWidthPanel, dWidthPanel, dWidthPanel };
		double tabHeight[] = { 0.01,0.01,0.01,0.01 };
		bool sides[] = { true, false, false, false,       true, false, false, false,       true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}

	pStart.rotateBy(rangl / 2, mvU, p1);
	vU_St.rotateBy(rangl / 2, mvU);
		
	pStart += vU_St * -0.4;

	rangl = M_PI * (4.8) / 180.0;
	vU_St.rotateBy(rangl, mvU);

	FdPoint3d   pp2 = cpCon + mv * dHeightConn / 2 - mvShift * dWidthConnTop / 2;
	FdVector3d nv(pStart.x - pp2.x, pStart.y - pp2.y, pStart.z - pp2.z);
	double lenv = nv.length();
	nv.normalize();
	pStart -= nv * lenv / 2;
	

	for (int i = 0; i < 1; i++)
	{
		//pStart.rotateBy(rangl, mvU, p1);
		//vU_St.rotateBy(rangl, mvU);

		p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];

		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mvShift, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mvShift);
			v[j] = v_tmp.rotateBy(rangl2, mvShift);

		}
		double tabWidth[] = { dWidthPanel2, dWidthPanel2, dWidthPanel2, dWidthPanel2 };
		double tabHeight[] = { 0.01, 0.01, 0.01, 0.01 };
		bool sides[] = { true, false, false, false, true, false, false, false, true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}





	cpCon.set(0, 0, 0);
	cpCon = cpCon + b / 2 * mvU; // +L / 2 * mvU;

	p1 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
	pStart = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;

	vU_St = mv;
	v_St = -mvU;

	p2 = cpCon + mv * dHeightConn / 2 - mvShift * 45.6;

	//tabWidth[0] = tabWidth[1] = dWidthPanel;

	rangl = M_PI * (360.0 / 14.0) / 180.0;
	rangl2 = M_PI * (360.0 / 12.0) / 180.0;

	for (int i = 0; i < 6; i++)
	{
		pStart.rotateBy(rangl, mvU, p1);
		vU_St.rotateBy(rangl, mvU);

		p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];

		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mvShift, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mvShift);
			v[j] = v_tmp.rotateBy(rangl2, mvShift);

		}
		double tabWidth[] = { dWidthPanel, dWidthPanel, dWidthPanel, dWidthPanel };
		double tabHeight[] = { 0.01, 0.01, 0.01, 0.01 };
		bool sides[] = { true, false, false, false, true, false, false, false, true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}

	pStart.rotateBy(rangl / 2, mvU, p1);
	vU_St.rotateBy(rangl / 2, mvU);

	pStart += vU_St * -0.4;

	rangl = M_PI * (-4.8) / 180.0;
	vU_St.rotateBy(rangl, mvU);

	pp2 = cpCon + mv * dHeightConn / 2 + mvShift * dWidthConnTop / 2;
	nv.set(pStart.x - pp2.x, pStart.y - pp2.y, pStart.z - pp2.z);
	lenv = nv.length();
	nv.normalize();
	pStart -= nv * lenv / 2;


	for (int i = 0; i < 1; i++)
	{
		//pStart.rotateBy(rangl, mvU, p1);
		//vU_St.rotateBy(rangl, mvU);

		p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];

		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mvShift, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mvShift);
			v[j] = v_tmp.rotateBy(rangl2, mvShift);

		}
		double tabWidth[] = { dWidthPanel2, dWidthPanel2, dWidthPanel2, dWidthPanel2 };
		double tabHeight[] = { 0.01, 0.01, 0.01, 0.01 };
		bool sides[] = { true, false, false, false, true, false, false, false, true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}




	cpCon.set(0, 0, 0);
	cpCon = cpCon + b / 2 * mvU; // +L / 2 * mvU;

	//p1 = cpCon + mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
	pStart = cpCon - mv * dHeightConn / 2;// +mvShift * 45.6;

	vU_St = mv;
	v_St = -mvU;

	p2 = cpCon + mv * dHeightConn / 2;// -mvShift * 45.6;

	//tabWidth[0] = tabWidth[1] = dWidthPanel;

	rangl = M_PI * (360.0 / 14.0) / 180.0;
	rangl2 = M_PI * (360.0 / 12.0) / 180.0;

	for (int i = 0; i < 1; i++)
	{
		//pStart.rotateBy(rangl, mvU, p1);
		//vU_St.rotateBy(rangl, mvU);

		p2.x = pStart.x;

		FdVector3d v[4];
		FdVector3d vU[4];
		FdPoint3d pB[4];

		FdPoint3d pTmp = pStart;
		pB[0] = pTmp;// .rotateBy(rangl2, mvShift, p2);

		FdVector3d vU_tmp = vU_St;
		vU[0] = vU_tmp;// .rotateBy(rangl2, mvShift);

		FdVector3d v_tmp = v_St;
		v[0] = v_tmp;// .rotateBy(rangl2, mvShift);

		for (int j = 1; j < 4; j++)
		{
			pB[j] = pTmp.rotateBy(rangl2, mvShift, p2);
			vU[j] = vU_tmp.rotateBy(rangl2, mvShift);
			v[j] = v_tmp.rotateBy(rangl2, mvShift);

		}
		double tabWidth[] = { dWidthConnBot, dWidthConnBot, dWidthConnBot, dWidthConnBot };
		double tabHeight[] = { 0.01, 0.01, 0.01, 0.01 };
		bool sides[] = { true, false, false, false, true, false, false, false, true, false, false, false };

		bool edges[][4] =
		{
			true, false, false, false,
			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false,

			true, true, false, false,
			true, false, false, false
		};

		makeBox(3, pB, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	}


	return 0;
}
short AlnorBlockCreator::makeFLX_VODS()
{


	postTransformMesh(ARX_PI / 2, FdVector3d::kXAxis);


	ads_real A, B, C, L; // , a, b;

	A = B = C = 0;

	get_val("A", A);
	get_val("B", B);
	get_val("L", L);
	//get_val("a", a);
	//get_val("b", b);

	if ( A ==0 )
		A = 160;
	if (B == 0)
		B = 160;
	if (C == 0)
		C = 70;
	if (L == 0)
		L = 80;


	FdPoint3d
		p1(0, 0, A / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -A / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	double tabWidth[] = { B, B };
	double tabHeight[] = { C, C };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);



	double dHeightConn = 38;

	double dWidthConnBot = 98;
	double dWidthConnTop = 48;
	double dWidthPanel = 6.85;

	double dWidthPanel2 = 26.25;

	FdVector3d mv = vy;
	FdVector3d mvU = vz;
	FdVector3d mvShift = vx;

	double rangl = M_PI * (-360.0 / 14.0) / 180.0;

	FdPoint3d cpCon(  0, 0,  A/2 + L / 2);

	//double dWidthShift = A;
	double dHeightShift = A;


		cp[0] = cpCon - mv * dHeightConn / 2;
		cp[1] = cpCon - mv * dHeightConn / 2;
		sides[0] = true;
		v[0] = v[1] = mv;
		vU[0] = vU[1] = mvU;
		tabHeight[0] = tabHeight[1] = L;
		tabWidth[0] = tabWidth[1] = dWidthConnBot;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		cp[0] = cpCon + mv * dHeightConn / 2;
		cp[1] = cpCon + mv * dHeightConn / 2;
		tabWidth[0] = tabWidth[1] = dWidthConnTop;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		p1 = cpCon - mv * (dHeightConn / 2 - 15) - mvShift * 45.6;
		cp[0] = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;
		cp[1] = cpCon - mv * dHeightConn / 2 - mvShift * 45.6;
		tabWidth[0] = tabWidth[1] = dWidthPanel;

		rangl = M_PI * (-360.0 / 14.0) / 180.0;

		for (int i = 0; i < 6; i++)
		{
			cp[0].rotateBy(rangl, mvU, p1);
			cp[1].rotateBy(rangl, mvU, p1);
			v[0] = v[0].rotateBy(rangl, mvU);
			v[1] = v[1].rotateBy(rangl, mvU);
			makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		}

		cp[0].rotateBy(rangl / 2, mvU, p1);
		cp[1].rotateBy(rangl / 2, mvU, p1);
		v[0] = v[0].rotateBy(rangl / 2, mvU);
		v[1] = v[1].rotateBy(rangl / 2, mvU);

		cp[0] += v[0] * -0.4;
		cp[1] += v[0] * -0.4;

		rangl = M_PI * (4.8) / 180.0;
		v[0] = v[0].rotateBy(rangl, mvU);
		v[1] = v[1].rotateBy(rangl, mvU);

		p2 = cpCon + mv * dHeightConn / 2 - mvShift * dWidthConnTop / 2;
		FdVector3d nv(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
		double lenv = nv.length();
		nv.normalize();
		cp[0] -= nv * lenv / 2;
		cp[1] -= nv * lenv / 2;

		tabWidth[0] = tabWidth[1] = dWidthPanel2;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);



		p1 = cpCon - mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
		cp[0] = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;
		cp[1] = cpCon - mv * dHeightConn / 2 + mvShift * 45.6;
		v[0] = v[1] = mv;
		tabWidth[0] = tabWidth[1] = dWidthPanel;

		rangl = M_PI * (360.0 / 14.0) / 180.0;

		for (int i = 0; i < 6; i++)
		{
			cp[0].rotateBy(rangl, mvU, p1);
			cp[1].rotateBy(rangl, mvU, p1);
			v[0] = v[0].rotateBy(rangl, mvU);
			v[1] = v[1].rotateBy(rangl, mvU);
			makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		}

		cp[0].rotateBy(rangl / 2, mvU, p1);
		cp[1].rotateBy(rangl / 2, mvU, p1);
		v[0] = v[0].rotateBy(rangl / 2, mvU);
		v[1] = v[1].rotateBy(rangl / 2, mvU);

		cp[0] += v[0] * -0.4;
		cp[1] += v[0] * -0.4;

		rangl = M_PI * (-4.8) / 180.0;
		v[0] = v[0].rotateBy(rangl, mvU);
		v[1] = v[1].rotateBy(rangl, mvU);

		p2 = cpCon + mv * dHeightConn / 2 + mvShift * dWidthConnTop / 2;
		nv.set(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
		lenv = nv.length();
		nv.normalize();
		cp[0] -= nv * lenv / 2;
		cp[1] -= nv * lenv / 2;
		tabWidth[0] = tabWidth[1] = dWidthPanel2;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);


		// It moves point  on the opposite side 
		//*******
		cpCon.set(0, 0, -A / 2 - L / 2);
		//mvU = -vz;
		//*******

		/*
			FdVector3d mv = vy;
			FdVector3d mvU = vz;
			FdVector3d mvShift = vx;

			double rangl = M_PI * (-360.0 / 14.0) / 180.0;
		*/

		cp[0] = cpCon + mv * dHeightConn / 2;
		cp[1] = cpCon + mv * dHeightConn / 2;
		sides[0] = true;
		v[0] = v[1] = mv;
		vU[0] = vU[1] = mvU;
		tabHeight[0] = tabHeight[1] = L;
		tabWidth[0] = tabWidth[1] = dWidthConnBot;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		cp[0] = cpCon - mv * dHeightConn / 2;
		cp[1] = cpCon - mv * dHeightConn / 2;
		tabWidth[0] = tabWidth[1] = dWidthConnTop;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);


		p1 = cpCon + mv * (dHeightConn / 2 - 15) - mvShift * 45.6;
		cp[0] = cpCon + mv * dHeightConn / 2 - mvShift * 45.6;
		cp[1] = cpCon + mv * dHeightConn / 2 - mvShift * 45.6;
		tabWidth[0] = tabWidth[1] = dWidthPanel;

		rangl = M_PI * ( 360.0 / 14.0) / 180.0;

		for (int i = 0; i < 6; i++)
		{
			cp[0].rotateBy(rangl, mvU, p1);
			cp[1].rotateBy(rangl, mvU, p1);
			v[0] = v[0].rotateBy(rangl, mvU);
			v[1] = v[1].rotateBy(rangl, mvU);
			makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		}

		

		cp[0].rotateBy(rangl / 2, mvU, p1);
		cp[1].rotateBy(rangl / 2, mvU, p1);
		v[0] = v[0].rotateBy(rangl / 2, mvU);
		v[1] = v[1].rotateBy(rangl / 2, mvU);

		cp[0] -= v[0] * -0.4;
		cp[1] -= v[0] * -0.4;

		rangl = M_PI * (-4.8) / 180.0;
		v[0] = v[0].rotateBy(rangl, mvU);
		v[1] = v[1].rotateBy(rangl, mvU);

		p2 = cpCon - mv * dHeightConn / 2 - mvShift * dWidthConnTop / 2;
		
		nv.set(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
		lenv = nv.length();
		nv.normalize();
		cp[0] -= nv * lenv / 2;
		cp[1] -= nv * lenv / 2;

		tabWidth[0] = tabWidth[1] = dWidthPanel2;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		

		p1 = cpCon + mv * (dHeightConn / 2 - 15) + mvShift * 45.6;
		cp[0] = cpCon + mv * dHeightConn / 2 + mvShift * 45.6;
		cp[1] = cpCon + mv * dHeightConn / 2 + mvShift * 45.6;
		v[0] = v[1] = mv;
		tabWidth[0] = tabWidth[1] = dWidthPanel;

		rangl = M_PI * ( -360.0 / 14.0) / 180.0;

		for (int i = 0; i < 6; i++)
		{
			cp[0].rotateBy(rangl, mvU, p1);
			cp[1].rotateBy(rangl, mvU, p1);
			v[0] = v[0].rotateBy(rangl, mvU);
			v[1] = v[1].rotateBy(rangl, mvU);
			makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		}



		cp[0].rotateBy(rangl / 2, mvU, p1);
		cp[1].rotateBy(rangl / 2, mvU, p1);
		v[0] = v[0].rotateBy(rangl / 2, mvU);
		v[1] = v[1].rotateBy(rangl / 2, mvU);

		cp[0] -= v[0] * -0.4;
		cp[1] -= v[0] * -0.4;

		rangl = M_PI * (4.8) / 180.0;
		v[0] = v[0].rotateBy(rangl, mvU);
		v[1] = v[1].rotateBy(rangl, mvU);

		p2 = cpCon - mv * dHeightConn / 2 + mvShift * dWidthConnTop / 2;
		nv.set(cp[0].x - p2.x, cp[0].y - p2.y, cp[0].z - p2.z);
		lenv = nv.length();
		nv.normalize();
		cp[0] -= nv * lenv / 2;
		cp[1] -= nv * lenv / 2;
		tabWidth[0] = tabWidth[1] = dWidthPanel2;

		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);



	return 0;
}

#ifdef __OLD_CODE_WITH_LUX_


short AlnorBlockCreator::makeFLX_PRO()
{
	ads_real A, B, C, L, A2;
	ads_real d1, d2;
	short n;

	get_val("PBox_D", A);
	get_val("A2", A2);
	get_val("B", B);
	get_val("C", C);
	get_val("L", L);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("n", n);

	FdPoint3d
		p1(0, 0, A / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -A / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	double tabWidth[] = { B, B };
	double tabHeight[] = { C, C };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);

	BOOL bResist = FALSE;
	/*
	WCHAR wd[40] = { L"" };
	WCHAR * wdp = wd;

	get_val("_res", wdp);

	if (wd[0] == L'C' )
	bResist = TRUE;

	if (wcschr(wd, L'С') != NULL)
	bResist = TRUE;
	*/
	char *pc;
	get_val("_res", pc);

	if (*pc == L'C')//|| *pc == L'c')
		bResist = TRUE;

	p1.set(0, C / 2, 0);
	makeSymbolicCircle(p1, vy, d1);

	double dPoint = 0.7;
	if (L > 100)
		dPoint = 0.84;


#ifdef  __LUX__
	if (bResist == TRUE)
	{

		p2.set(0, C / 2 + L*dPoint, 0);
		makeVerySimpleTube(p1, p2, d1, 4);

		p1 = p2;
		p2 = p1 + vy * 2;// L * 0.05;
		FdPoint3d cp2[] = { p1, p2 };
		makeSimpleTube(cp2, d1, d1*1.05, 4);

		cp2[0] = cp2[1];
		cp2[1] += vy * 2;// 0.05;
		makeSimpleTube(cp2, d1 * 1.05, d1 * 1.05, 4);

		cp2[0] = cp2[1];
		cp2[1] += vy * 2;// 0.05;
		makeSimpleTube(cp2, d1 * 1.05, d1, 4);

		cp2[0] = cp2[1];
		p1.set(0, C / 2, 0);
		cp2[1] = p1 + vy * L;// *0.15;
		makeSimpleTube(cp2, d1, d1, 4);
	}
	else
	{
		p2.set(0, C / 2 + L, 0);
		makeVerySimpleTube(p1, p2, d1, 4);
	}
#else
	p2.set(0, C / 2 + L, 0);
	makeVerySimpleTube(p1, p2, d1, 4);
#endif


#ifdef  __LUX__

	// выступы вокруг трубы
	p1.set(0, C / 2, 0);
	p2 = p1 + vy*(d1 / 20); // p2.set(0, C + d1 / 20, 0);
	makeVerySimpleTube(p1, p2, d1 + 2, 4);
	makeFlatRing(p2, vy, d1, d1 + 2, 4);

	makeFlatRing(p1 + vy * 1, vy, d1 + 2, d1 + 30, 4);
	p2 = p1 + vy * 1; // p2.set(0, C + 1, 0);
	makeVerySimpleTube(p1, p2, d1 + 30, 4);



	p1.set(0, C / 2, 0);
	p2 = p1 + vy * 1;
	double rangl = M_PI * 22.5 / 180.0;
	cp[0] = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1] = cp[0] + vy * 1;
	tabWidth[0] = tabWidth[1] = 2;
	tabHeight[0] = tabHeight[1] = 2;
	v[0] = v[1] = vy;
	vU[0] = vU[1] = vz;
	sides[0] = true;


	// болты   // bolts aroгnd  tube
	for (int i = 0; i < 16; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0].rotateBy(rangl, vy, p1);
		cp[1].rotateBy(rangl, vy, p1);
		vU[0] = vU[0].rotateBy(rangl, vy);
		vU[1] = vU[1].rotateBy(rangl, vy);
	}

	// болты по корпусу
	cp[0].set(-B / 2 + 5, C / 2, -A / 2 + 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(-B / 2 + 5, C / 2 + 1, -A / 2 + 5);  //cp[1] = cp[0] + vy * 1;
	v[0] = v[1] = vy;
	vU[0] = vU[1] = vz;
	for (int i = 0; i < 6; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vz * (A - 10) / 5;
		cp[1] += vz * (A - 10) / 5;
	}
	cp[0].set(B / 2 - 5, C / 2, -A / 2 + 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(B / 2 - 5, C / 2 + 1, -A / 2 + 5);  //cp[1] = cp[0] + vy * 1;
	for (int i = 0; i < 6; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vz * (A - 10) / 5;
		cp[1] += vz * (A - 10) / 5;
	}
	cp[0].set(-B / 2 + 5 + B / 6, C / 2, -A / 2 + 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(-B / 2 + 5 + B / 6, C / 2 + 1, -A / 2 + 5);  //cp[1] = cp[0] + vy * 1;
	for (int i = 0; i < 5; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vx * (B - 10) / 6;
		cp[1] += vx * (B - 10) / 6;
	}
	cp[0].set(-B / 2 + 5 + B / 6, C / 2, A / 2 - 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(-B / 2 + 5 + B / 6, C / 2 + 1, A / 2 - 5);  //cp[1] = cp[0] + vy * 1;
	for (int i = 0; i < 5; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vx * (B - 10) / 6;
		cp[1] += vx * (B - 10) / 6;
	}
#endif

	if (d2 <= 63) A2 = 30;
	else A2 = 45;



	if (n < 1 || n>3) n = 1;

	p1.set(-B / 2 + B / (2 * n), 0, A / 2);

#ifdef  __LUX__

	p2 = p1 + vz * A2 * 0.45;       //p2.set( -B / 4, C / 2, A / 2 + A2);

	double dd = 0.95;
	if (bResist == TRUE)
		dd = 1.05;

	for (int i = 0; i < n; i++)
	{
		makeSymbolicCircle(p1, vz, d2);
		makeVerySimpleTube(p1, p2, d2, 4);

		cp[0] = p2;
		cp[1] = p2 + vz * A2*0.05;
		makeSimpleTube(cp, d2, d2 * dd, 4);

		cp[0] = cp[1];
		cp[1] += vz * A2*0.05;
		makeSimpleTube(cp, d2 * dd, d2 * dd, 4);

		cp[0] = cp[1];
		cp[1] += vz * A2*0.05;
		makeSimpleTube(cp, d2 * dd, d2, 4);

		cp[0] = cp[1];
		cp[1] += vz * A2*0.45;
		makeSimpleTube(cp, d2, d2, 4);

		makeFlatRing(p1 + vz * 1, vz, d2 + 2, d2 + 8, 4);
		p2 = p1 + vz * 1;       // .set(0, C / 2, A / 2 + 1);
		makeVerySimpleTube(p1, p2, d2 + 8, 4);

		p1 += (vx * B / n);// dDelta);
		p2 = p1 + vz * A2 * 0.45;
	}
#else
	p2 = p1 + vz * A2;
	for (int i = 0; i < n; i++)
	{
		makeSymbolicCircle(p1, vz, d2);
		makeVerySimpleTube(p1, p2, d2, 4);

		p1 += (vx * B / n);// dDelta);
		p2 = p1 + vz * A2;
	}
#endif

	return 0;
}

short AlnorBlockCreator::makeFLX_PRO_PL()
{
	postTransformMesh(ARX_PI / -2, FdVector3d::kXAxis);

	ads_real A, B, C, L, A2;
	ads_real d1, d2;
	short n;

	get_val("A", A);
	get_val("A2", A2);
	get_val("B", B);
	get_val("PBox_C", C);
	get_val("L", L);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("n", n);

	FdPoint3d
		p1(0, 0, A / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -A / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	double tabWidth[] = { B, B };
	double tabHeight[] = { C, C };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);

	BOOL bResist = FALSE;

	char *pc;
	get_val("_res", pc);

	if (*pc == L'C')//|| *pc == L'c')
		bResist = TRUE;

	p1.set(0, C / 2, 0);
	makeSymbolicCircle(p1, vy, d1);

	double dPoint = 0.7;
	if (L > 100)
		dPoint = 0.84;

	if (bResist == TRUE)
	{

		p2.set(0, C / 2 + L*dPoint, 0);
		makeVerySimpleTube(p1, p2, d1, 4);

		p1 = p2;
		p2 = p1 + vy * 2;// L * 0.05;
		FdPoint3d cp2[] = { p1, p2 };
		makeSimpleTube(cp2, d1, d1*1.05, 4);

		cp2[0] = cp2[1];
		cp2[1] += vy * 2;// 0.05;
		makeSimpleTube(cp2, d1 * 1.05, d1 * 1.05, 4);

		cp2[0] = cp2[1];
		cp2[1] += vy * 2;// 0.05;
		makeSimpleTube(cp2, d1 * 1.05, d1, 4);

		cp2[0] = cp2[1];
		p1.set(0, C / 2, 0);
		cp2[1] = p1 + vy * L;// *0.15;
		makeSimpleTube(cp2, d1, d1, 4);
	}
	else
	{
		p2.set(0, C / 2 + L, 0);
		makeVerySimpleTube(p1, p2, d1, 4);
	}

	p1.set(0, C / 2, 0);
	p2 = p1 + vy*(d1 / 20); // p2.set(0, C + d1 / 20, 0);
	makeVerySimpleTube(p1, p2, d1 + 2, 4);
	makeFlatRing(p2, vy, d1, d1 + 2, 4);

	makeFlatRing(p1 + vy * 1, vy, d1 + 2, d1 + 30, 4);
	p2 = p1 + vy * 1; // p2.set(0, C + 1, 0);
	makeVerySimpleTube(p1, p2, d1 + 30, 4);



	p1.set(0, C / 2, 0);
	p2 = p1 + vy * 1;
	double rangl = M_PI * 22.5 / 180.0;
	cp[0] = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1] = cp[0] + vy * 1;
	tabWidth[0] = tabWidth[1] = 2;
	tabHeight[0] = tabHeight[1] = 2;
	v[0] = v[1] = vy;
	vU[0] = vU[1] = vz;
	sides[0] = true;

	for (int i = 0; i < 16; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0].rotateBy(rangl, vy, p1);
		cp[1].rotateBy(rangl, vy, p1);
		vU[0] = vU[0].rotateBy(rangl, vy);
		vU[1] = vU[1].rotateBy(rangl, vy);
	}


	cp[0].set(-B / 2 + 5, -C / 2, -A / 2 + 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(-B / 2 + 5, -C / 2 - 1, -A / 2 + 5);  //cp[1] = cp[0] + vy * 1;
	v[0] = v[1] = vy;
	vU[0] = vU[1] = vz;
	for (int i = 0; i < 6; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vz * (A - 10) / 5;
		cp[1] += vz * (A - 10) / 5;
	}
	cp[0].set(B / 2 - 5, -C / 2, -A / 2 + 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(B / 2 - 5, -C / 2 - 1, -A / 2 + 5);  //cp[1] = cp[0] + vy * 1;
	for (int i = 0; i < 6; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vz * (A - 10) / 5;
		cp[1] += vz * (A - 10) / 5;
	}
	cp[0].set(-B / 2 + 5 + B / 6, -C / 2, -A / 2 + 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(-B / 2 + 5 + B / 6, -C / 2 - 1, -A / 2 + 5);  //cp[1] = cp[0] + vy * 1;
	for (int i = 0; i < 5; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vx * (B - 10) / 6;
		cp[1] += vx * (B - 10) / 6;
	}
	cp[0].set(-B / 2 + 5 + B / 6, -C / 2, A / 2 - 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(-B / 2 + 5 + B / 6, -C / 2 - 1, A / 2 - 5);  //cp[1] = cp[0] + vy * 1;
	for (int i = 0; i < 5; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vx * (B - 10) / 6;
		cp[1] += vx * (B - 10) / 6;
	}

	if (d2 <= 63) A2 = 30;
	else A2 = 45;

	double dd = 0.95;
	if (bResist == TRUE)
		dd = 1.05;


	if (n < 1 || n>3) n = 1;

	p1.set(-B / 2 + B / (2 * n), -C / 2, 0);
	p2 = p1 + -vy * A2 * 0.45;       //p2.set( -B / 4, C / 2, A / 2 + A2);


	for (int i = 0; i < n; i++)
	{
		makeSymbolicCircle(p1, -vy, d2);
		makeVerySimpleTube(p1, p2, d2, 4);

		cp[0] = p2;
		cp[1] = p2 + -vy * A2*0.05;
		makeSimpleTube(cp, d2, d2 * dd, 4);

		cp[0] = cp[1];
		cp[1] += -vy * A2*0.05;
		makeSimpleTube(cp, d2 * dd, d2 * dd, 4);

		cp[0] = cp[1];
		cp[1] += -vy * A2*0.05;
		makeSimpleTube(cp, d2 * dd, d2, 4);

		cp[0] = cp[1];
		cp[1] += -vy * A2*0.45;
		makeSimpleTube(cp, d2, d2, 4);

		makeFlatRing(p1 + -vy * 1, -vy, d2 + 2, d2 + 8, 4);
		p2 = p1 + -vy * 1;       // .set(0, C / 2, A / 2 + 1);
		makeVerySimpleTube(p1, p2, d2 + 8, 4);

		p1 += (vx * B / n);// dDelta);
		p2 = p1 + -vy * A2 * 0.45;
	}

	return 0;
}


short AlnorBlockCreator::makeFLX_PRO_P()
{

	postTransformMesh(ARX_PI / -2, FdVector3d::kXAxis);

	ads_real A, B, C, L, A2;
	ads_real d1, d2;
	short n;

	get_val("A", B);
	get_val("A2", A2);
	get_val("B", C);
	get_val("PBox_C", A);
	get_val("L", L);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("n", n);

	FdPoint3d
		p1(0, 0, A / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -A / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	double tabWidth[] = { B, B };
	double tabHeight[] = { C, C };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);

	BOOL bResist = FALSE;

	char *pc;
	get_val("_res", pc);

	if (*pc == L'C')//|| *pc == L'c')
		bResist = TRUE;

	p1.set(0, C / 2, 0);
	makeSymbolicCircle(p1, vy, d1);

	double dPoint = 0.7;
	if (L > 100)
		dPoint = 0.84;

	if (bResist == TRUE)
	{

		p2.set(0, C / 2 + L*dPoint, 0);
		makeVerySimpleTube(p1, p2, d1, 4);

		p1 = p2;
		p2 = p1 + vy * 2;// L * 0.05;
		FdPoint3d cp2[] = { p1, p2 };
		makeSimpleTube(cp2, d1, d1*1.05, 4);

		cp2[0] = cp2[1];
		cp2[1] += vy * 2;// 0.05;
		makeSimpleTube(cp2, d1 * 1.05, d1 * 1.05, 4);

		cp2[0] = cp2[1];
		cp2[1] += vy * 2;// 0.05;
		makeSimpleTube(cp2, d1 * 1.05, d1, 4);

		cp2[0] = cp2[1];
		p1.set(0, C / 2, 0);
		cp2[1] = p1 + vy * L;// *0.15;
		makeSimpleTube(cp2, d1, d1, 4);
	}
	else
	{
		p2.set(0, C / 2 + L, 0);
		makeVerySimpleTube(p1, p2, d1, 4);
	}

	p1.set(0, C / 2, 0);
	p2 = p1 + vy*(d1 / 20); // p2.set(0, C + d1 / 20, 0);
	makeVerySimpleTube(p1, p2, d1 + 2, 4);
	makeFlatRing(p2, vy, d1, d1 + 2, 4);

	makeFlatRing(p1 + vy * 1, vy, d1 + 2, d1 + 20, 4);
	p2 = p1 + vy * 1; // p2.set(0, C + 1, 0);
	makeVerySimpleTube(p1, p2, d1 + 20, 4);



	p1.set(0, C / 2, 0);
	p2 = p1 + vy * 1;
	double rangl = M_PI * 22.5 / 180.0;
	cp[0] = p2 - vx * ((d1 + 20) / 2 - 5);
	cp[1] = cp[0] + vy * 1;
	tabWidth[0] = tabWidth[1] = 2;
	tabHeight[0] = tabHeight[1] = 2;
	v[0] = v[1] = vy;
	vU[0] = vU[1] = vz;
	sides[0] = true;

	for (int i = 0; i < 16; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0].rotateBy(rangl, vy, p1);
		cp[1].rotateBy(rangl, vy, p1);
		vU[0] = vU[0].rotateBy(rangl, vy);
		vU[1] = vU[1].rotateBy(rangl, vy);
	}


	cp[0].set(-B / 2 + 5, -C / 2, -A / 2 + 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(-B / 2 + 5, -C / 2 - 1, -A / 2 + 5);  //cp[1] = cp[0] + vy * 1;
	v[0] = v[1] = vy;
	vU[0] = vU[1] = vz;
	for (int i = 0; i < 6; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vz * (A - 10) / 5;
		cp[1] += vz * (A - 10) / 5;
	}
	cp[0].set(B / 2 - 5, -C / 2, -A / 2 + 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(B / 2 - 5, -C / 2 - 1, -A / 2 + 5);  //cp[1] = cp[0] + vy * 1;
	for (int i = 0; i < 6; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vz * (A - 10) / 5;
		cp[1] += vz * (A - 10) / 5;
	}
	cp[0].set(-B / 2 + 5 + B / 6, -C / 2, -A / 2 + 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(-B / 2 + 5 + B / 6, -C / 2 - 1, -A / 2 + 5);  //cp[1] = cp[0] + vy * 1;
	for (int i = 0; i < 5; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vx * (B - 10) / 6;
		cp[1] += vx * (B - 10) / 6;
	}
	cp[0].set(-B / 2 + 5 + B / 6, -C / 2, A / 2 - 5);   // = p2 - vx * ((d1 + 30) / 2 - 5);
	cp[1].set(-B / 2 + 5 + B / 6, -C / 2 - 1, A / 2 - 5);  //cp[1] = cp[0] + vy * 1;
	for (int i = 0; i < 5; i++)
	{
		makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
		cp[0] += vx * (B - 10) / 6;
		cp[1] += vx * (B - 10) / 6;
	}

	if (d2 <= 63) A2 = 30;
	else A2 = 45;

	double dd = 0.95;
	if (bResist == TRUE)
		dd = 1.05;


	if (n < 10 || n>12) n = 10;

	short n2 = n / 2;



	p1.set(-B / 2 + B / (2 * n2), -C / 2, -A / 4);
	p2 = p1 + -vy * A2 * 0.45;       //p2.set( -B / 4, C / 2, A / 2 + A2);


	for (int i = 0; i < n2; i++)
	{
		makeSymbolicCircle(p1, -vy, d2);
		makeVerySimpleTube(p1, p2, d2, 4);

		cp[0] = p2;
		cp[1] = p2 + -vy * A2*0.05;
		makeSimpleTube(cp, d2, d2 * dd, 4);

		cp[0] = cp[1];
		cp[1] += -vy * A2*0.05;
		makeSimpleTube(cp, d2 * dd, d2 * dd, 4);

		cp[0] = cp[1];
		cp[1] += -vy * A2*0.05;
		makeSimpleTube(cp, d2 * dd, d2, 4);

		cp[0] = cp[1];
		cp[1] += -vy * A2*0.45;
		makeSimpleTube(cp, d2, d2, 4);

		makeFlatRing(p1 + -vy * 1, -vy, d2 + 2, d2 + 8, 4);
		p2 = p1 + -vy * 1;       // .set(0, C / 2, A / 2 + 1);
		makeVerySimpleTube(p1, p2, d2 + 8, 4);

		p1 += (vx * B / n2);// dDelta);
		p2 = p1 + -vy * A2 * 0.45;
	}



	p1.set(-B / 2 + B / (2 * n2), -C / 2, A / 4);
	p2 = p1 + -vy * A2 * 0.45;       //p2.set( -B / 4, C / 2, A / 2 + A2);

	for (int i = 0; i < n2; i++)
	{
		makeSymbolicCircle(p1, -vy, d2);
		makeVerySimpleTube(p1, p2, d2, 4);

		cp[0] = p2;
		cp[1] = p2 + -vy * A2*0.05;
		makeSimpleTube(cp, d2, d2 * dd, 4);

		cp[0] = cp[1];
		cp[1] += -vy * A2*0.05;
		makeSimpleTube(cp, d2 * dd, d2 * dd, 4);

		cp[0] = cp[1];
		cp[1] += -vy * A2*0.05;
		makeSimpleTube(cp, d2 * dd, d2, 4);

		cp[0] = cp[1];
		cp[1] += -vy * A2*0.45;
		makeSimpleTube(cp, d2, d2, 4);

		makeFlatRing(p1 + -vy * 1, -vy, d2 + 2, d2 + 8, 4);
		p2 = p1 + -vy * 1;       // .set(0, C / 2, A / 2 + 1);
		makeVerySimpleTube(p1, p2, d2 + 8, 4);

		p1 += (vx * B / n2);// dDelta);
		p2 = p1 + -vy * A2 * 0.45;
	}
	return 0;
}


short AlnorBlockCreator::makeFLX_PRV_14()
{
	ads_real A, B, C, L, A2;
	ads_real d1, d2;
	short n;

	get_val("PBox_D", A);
	get_val("A2", A2);
	get_val("B", B);
	get_val("C", C);
	get_val("L", L);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("n", n);


	FdPoint3d
		p1(0, 0, A / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -A / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	double tabWidth[] = { B, B };
	double tabHeight[] = { C, C };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);

	p1.set(0, C / 2, 0);
	makeSymbolicCircle(p1, vy, d1);
	p2.set(0, C / 2 + L, 0);
	makeVerySimpleTube(p1, p2, d1, 4);

	return 0;
}

short AlnorBlockCreator::makeFLX_PRV_11()  // the olden days
{
	ads_real A, B, C, L, A2;
	ads_real d1, d2;
	short n;

	get_val("PBox_D", A);
	get_val("A2", A2);
	get_val("B", B);
	get_val("C", C);
	get_val("L", L);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("n", n);


	FdPoint3d
		p1(0, 0, A / 2),  //p1(0, C / 2, A / 2),
		p2(0, 0, -A / 2);   //p2(0, C / 2, -A / 2);

	FdPoint3d cp[] = { p1, p2 };

	double tabWidth[] = { B, B };
	double tabHeight[] = { C, C };
	bool sides[] = { false, true, true, true };
	FdVector3d v[] = { -vz, -vz };
	FdVector3d vU[] = { vy, vy };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

	bool sides_top[4] = { true, false, false, false };
	// make TOP
	makeBox(1, cp, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);

	p1.set(0, C / 2, 0);
	makeSymbolicCircle(p1, vy, d1);
	p2.set(0, C / 2 + L, 0);
	makeVerySimpleTube(p1, p2, d1, 4);

	return 0;
}

#endif

#include "StdAfx.h"
#include "GeoGeneral3D.h"
#include "Geo/Int/GrillsInt.h"

#define GkiBlockCreator SmkGenBlockCreator

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

// Some useful shortcuts for commonly used vectors.
#define xVec FdVector3d::kXAxis
#define yVec FdVector3d::kYAxis
#define zVec FdVector3d::kZAxis
#define orig FdPoint3d::kOrigin

// make Flange
short GkiBlockCreator::makeGKI_FLANGE()
{
	ads_real D, D1, D2, DLO, DB, L, S;

	short  nHole;// LO;

	get_val("d", D);  //450
	get_val("D1", D1);
	get_val("d2", D2);  // 560
	get_val("d_lo", DLO); //510
	get_val("DB", DB);  //9

	get_val("L", L); // 60
	get_val("S", S);
	get_val("LO", nHole); // 16

	/*
	if (D == 0)
		D = 450;
	if (D2 == 0)
		D2 = 560;
	if (DLO == 0)
		DLO = 510;
	if (DB == 0)
		DB = 9;
	if (L == 0)
		L = 60;
	if (nHole == 0)
		nHole = 16;
	*/

	int iCntSide = nHole;
	if (iCntSide == 8) iCntSide = 16;

	FdPoint3d  cP(0, 0, 0);

	FdVector3d mv = vx; // vz;
	FdVector3d mvU = vy;
	FdVector3d mvShift = -vz;// vx;


	FdPoint3d
		p1( cP - L * 0.34 / 2* mv),
		p2( cP + L * 0.34 / 2 * mv);

	makeVerySimpleTube(p1, p2, D2, iCntSide / 4);
	//makeVerySimpleTube(p1, p2, D, iCntSide / 4);
	makeFlatRing(p1, mv, D, D2, iCntSide / 4);
	makeFlatRing(p2, mv, D, D2, iCntSide / 4);

	p1 = cP + L * 0.34 / 2 * mv;
	p2 = cP - L * 0.66 * mv;
	makeVerySimpleTube(p1, p2, D, iCntSide / 4);


	double rangl = M_PI * (-360.0 / nHole) / 180.0;

	FdPoint3d pP1(cP - L * 0.34 / 2 * mv),
		pP2( cP + L * 0.34 / 2 * mv);

	pP1 = pP1 + mvU * DLO / 2;
	pP2 = pP2 + mvU * DLO / 2;

	for (int i = 0; i < nHole; i++)
	{
		makeSymbolicCircle(pP1, mv, DB);
		makeSymbolicCircle(pP2, mv, DB);
		pP1.rotateBy(rangl, mv);
		pP2.rotateBy(rangl, mv);
	}


	FdPoint3d pL1( cP),
		pL2( cP);

	pL1 = pL1 + mvU * D2 / 2;
	pL2 = pL2 + mvU * D2 / 2;

	rangl = M_PI * (-360.0 / iCntSide) / 180.0;

	for (int i = 0; i < iCntSide; i++)
	{
		pL2.rotateBy(rangl, mv);
		makeSymbolicLine(pL1, pL2);
		pL1 = pL2;
	}

	return 0;
}


// make Protection mesh
short GkiBlockCreator::makeGKI_PRMESH()
{
	postTransformMesh(ARX_PI / -2, FdVector3d::kYAxis);

	ads_real D, L, S;

	get_val("d", D);  // 110
	get_val("l", L); // 100
	get_val("s", S); // S

	/*
	if (D == 0)
		D = 110;
	if (L == 0)
		L = 100;
	if (S == 0)
		S = 3;
	*/

	int n = 4;

	FdPoint3d  cP(0, 0, 0);

	FdVector3d mv = vz;
	FdVector3d mvU = vy;
	FdVector3d mvShift = vx;

	FdPoint3d
		p1(cP - L / 2 * mv),
		p2(cP + L / 2 * mv);

	/*
	FdPoint3d pL1, pL2;
	pL1 = p1;
	pL2 = pL1 - mv * 100;
	makeSymbolicLine(pL1, pL2);
	pL2 = pL1 - mvU * 100;
	makeSymbolicLine(pL1, pL2);
	pL2 = pL1 - mvShift * 100;
	makeSymbolicLine(pL1, pL2);
	*/

	double rangl = M_PI * -32 / 180.0;

	FdVector3d mv2 = mv;
	mv2.rotateBy(rangl, mvShift);

	FdVector3d mvU2 = mvU;
	mvU2.rotateBy(rangl, mvShift);

	double a = tan(rangl) * D / 2;

	p1 = p1 + a * mv;

	/*
	pL1 = p1;
	pL2 = pL1 - mv * 100;
	makeSymbolicLine(pL1, pL2);
	pL2 = pL1 - mvU * 100;
	makeSymbolicLine(pL1, pL2);
	pL2 = pL1 - mvShift * 100;
	makeSymbolicLine(pL1, pL2);


	pL1 = p1;
	pL2 = pL1 - mv2 * 100;
	makeSymbolicLine(pL1, pL2);
	pL2 = pL1 - mvU2 * 100;
	makeSymbolicLine(pL1, pL2);
	*/


	FdPoint3d arP[] = { p2, p2, p1, p1 };  // center points of tube 1

	FdVector3d arV[] = { mv, mv, mv2, mv2 };
	FdVector3d arVU[] = { mvU, mvU, mvU2, mvU2 };

	double DiamMax = D / cos(rangl);

	double DiamIn = D - S * 2;
	double DiamInMax = DiamIn / cos(rangl);

	double arD[4][2] = { DiamIn, DiamIn, D, D,
		DiamMax, D, DiamInMax, DiamIn };

	makeTube(arP, arV, arVU, arD, n, 3, false, false);  // tube 1

	FdPoint3d arP2[] = { p2, p1 };  // center points of tube 1
	FdVector3d arV2[] = { mv, mv2 };
	FdVector3d arVU2[] = { mvU, mvU2 };
	double arD2[2][2] = { DiamIn, DiamIn,
		DiamInMax, DiamIn };

	makeTube(arP2, arV2, arVU2, arD2, n, 1, false, false);  // tube 1

	/*
	pL1 = p2;
	pL2 = pL1 - mv * 100;
	makeSymbolicLine(pL1, pL2);
	pL2 = pL1 - mvU * 100;
	makeSymbolicLine(pL1, pL2);
	pL2 = pL1 - mvShift * 100;
	makeSymbolicLine(pL1, pL2);
	*/


	return 0;
}


// make Wall passage
short GkiBlockCreator::makeGKI_WALLPASS()
{

	ads_real D, A, S, s1;

	get_val("d", D);  // 110
	get_val("A/A", A); // 100
	get_val("s", S); // S
	get_val("s1", s1); // S

	/*
	if (D == 0)
		D = 110;
	if (A == 0)
		A = 210;
	if (S == 0)
		S = 3;
	if (s1 == 0)
		s1 = 5;
	*/

	double lOut = 100;
	double L = 440;

	int n = 4;

	FdPoint3d  cP(0, 0, 0);

	FdVector3d mv = vx; // vz;
	FdVector3d mvU = vy;
	FdVector3d mvShift = -vz;// vx;

	FdPoint3d
		p1(cP - L / 2 * mv),
		p2(cP + L / 2 * mv);

	FdPoint3d arP[] = { p2, p2, p1, p1 };  // center points of tube 1

	FdVector3d arV[] = { mv, mv, mv, mv };
	FdVector3d arVU[] = { mvU, mvU, mvU, mvU };

	double DiamIn = D - S * 2;

	double arD[4][2] = { DiamIn, DiamIn, D, D,
		D, D, DiamIn, DiamIn };

	makeTube(arP, arV, arVU, arD, n, 3, false, false);  // tube 1

	FdPoint3d arP2[] = { p2, p1 };  // center points of tube 1
	//FdVector3d arV2[] = { mv, mv };
	//FdVector3d arVU2[] = { mvU, mvU };
	double arD2[2][2] = { DiamIn, DiamIn,
		DiamIn, DiamIn };

	makeTube(arP2, arV, arVU, arD2, n, 1, false, false);  // tube 1

	p1 = cP + L / 2 * mv;
	p1 = p1 - lOut / 2 * mv;
	p2 = p1 - s1 * mv;
	FdPoint3d arP3[] = { p1, p2 };

	double tabWidth[] = { A, A };
	double tabHeight[] = { A, A };
	bool sides[] = { true, true, true, true };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(1, arP3, arV, arVU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	makeSymbolicCircle(p1, mv, DiamIn);
	makeSymbolicCircle(p2, mv, DiamIn);

	p2 = cP - L / 2 * mv;
	p2 = p2 + lOut * mv;
	p1 = p2 + s1 * mv;
	FdPoint3d arP4[] = { p1, p2 };

	makeBox(1, arP4, arV, arVU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	makeSymbolicCircle(p1, mv, DiamIn);
	makeSymbolicCircle(p2, mv, DiamIn);


	return 0;

}


// make Tee-pieces 45degrees
short GkiBlockCreator::makeGKI_TEE45()
{

	ads_real d1, l1, l, s, d_cat;

	get_val("d1", d1);  // 110
	get_val("l", l); // 100
	get_val("l1", l1); // 100
	get_val("s", s); // 3
	get_val("d_cat", d_cat); 

	/*
	if (d1 == 0)
		d1 = 110;
	if (l == 0)
		l = 40;
	if (l1 == 0)
		l1 = 40;
	if (s == 0)
		s = 3;
	if (d_cat == 0)
		d_cat = 40;
    */

	int n = 4;

	FdPoint3d  cP(0, 0, 0);

	FdVector3d mv = vz;
	FdVector3d mvU = vy;
	FdVector3d mvShift = vx;

	cP = cP -mvShift * d1 / 2;

	double diam = d1;
	double radius = diam;
	double angle = 45;
	double rang = M_PI * angle / 180.0;


	
	double len = sin(rang / 2) * radius * 2;
	//l1 = l1 - len;// -l;

	//l1 = diam / 2;
	/*
	if (l <= len) l = diam / 4;
	else l = l - len;
	if (l < diam / 4) l = diam / 4;
	*/
	//l = 50;

	FdPoint3d p1;

	p1 = cP -mvU * radius;

	makeDonutSection(p1, -mv, mvU, radius, diam, angle, n, 4);

	FdPoint3d pT11, pT12;
	pT11 = cP;
	pT11.rotateBy(rang, -mv, p1);

	FdVector3d mvT1 = mvShift;
	mvT1.rotateBy(rang, -mv);
	pT12 = pT11 + mvT1 * l1;

	FdPoint3d arPT1[] = { pT11, pT12 };

	makeSimpleTube(arPT1, diam, diam, n);

	arPT1[0] = arPT1[1];
	arPT1[1] = arPT1[1] + mvT1 * l;

	makeSimpleTube(arPT1, diam, diam, n);


	FdPoint3d p2 = arPT1[1];
	p1 = arPT1[0];

	FdPoint3d arP21[] = { p1, p1, p2, p2 };
	double arrDiam[] = { diam, diam + s * 2, diam + s * 2, diam };

	makeUniVectorTube(arP21, mvT1, arrDiam, 4, 3);






	//FdPoint3d p2;
	p2 = cP + mvU * radius;

	FdVector3d mvR2 = -mvU;
	mvR2.rotateBy(rang, mv);

	makeDonutSection(p2, -mv, mvR2, radius, diam, angle, n, 4);


	FdPoint3d pT21, pT22;
	pT21 = cP;
	pT21.rotateBy(rang, mv, p2);

	FdVector3d mvT2 = mvShift;
	mvT2.rotateBy(rang, mv);
	pT22 = pT21 + mvT2 * l1;

	FdPoint3d arPT2[] = { pT21, pT22 };

	makeSimpleTube(arPT2, diam, diam, n);

	arPT2[0] = arPT2[1];
	arPT2[1] = arPT2[1] + mvT2 * l;

	makeSimpleTube(arPT2, diam, diam, n);


	p2 = arPT2[1];
	p1 = arPT2[0];

	FdPoint3d arP22[] = { p1, p1, p2, p2 };
	//double arrDiam[] = { diam, diam + s, diam + s, diam };

	makeUniVectorTube(arP22, mvT2, arrDiam, 4, 3);



	// front Tube
	FdPoint3d pTF1, pTF2;
	pTF1 = cP - mvShift * l;
	pTF2 = cP;

	FdPoint3d arPTF[] = { pTF1, pTF2 };

	makeSimpleTube(arPTF, diam, diam, n);


	FdPoint3d arPTF2[] = { pTF1, pTF1, pTF2, pTF2 };
	//double arrDiam[] = { diam, diam + s, diam + s, diam };

	makeUniVectorTube(arPTF2, mvShift, arrDiam, 4, 3);


	return 0;
}



// make Tee-pieces 90degrees
short GkiBlockCreator::makeGKI_TEE90()
{

	ads_real d1, l1, l, s, d_cat;

	get_val("d1", d1);  // 110
	get_val("l", l); // 100
	get_val("l1", l1); // 100
	get_val("s", s); // 3
	get_val("d_cat", d_cat);

	/*
	if (d1 == 0)
		d1 = 110;
	if (l == 0)
		l = 40;
	if (l1 == 0)
		l1 = 40;
	if (s == 0)
		s = 3;
	if (d_cat == 0)
		d_cat = 40;
	*/

	int n = 4;

	FdPoint3d  cP(0, 0, 0);

	FdVector3d mv = vz;
	FdVector3d mvU = vy;
	FdVector3d mvShift = vx;

	cP = cP - mvShift * d1/2;

	double diam = d1;
	double radius = diam;
	double angle = 90;
	double rang = M_PI * angle / 180.0;



	double len = sin(rang / 2) * radius * 2;

	/*
	if (l <= len) l = diam / 4;
	else l = l - len;
	if (l < diam / 4) l = diam / 4;
	*/
	//l = 50;

	FdPoint3d p1;

	p1 = cP - mvU * radius;

	makeDonutSection(p1, -mv, mvU, radius, diam, angle, n, 4);

	FdPoint3d pT11, pT12;
	pT11 = cP;
	pT11.rotateBy(rang, -mv, p1);

	FdVector3d mvT1 = mvShift;
	mvT1.rotateBy(rang, -mv);
	pT12 = pT11 + mvT1 * l;

	FdPoint3d arPT1[] = { pT11, pT12 };

	makeSimpleTube(arPT1, diam, diam, n);




	FdPoint3d p2;
	p2 = cP + mvU * radius;

	FdVector3d mvR2 = -mvU;
	mvR2.rotateBy(rang, mv);

	makeDonutSection(p2, -mv, mvR2, radius, diam, angle, n, 4);


	FdPoint3d pT21, pT22;
	pT21 = cP;
	pT21.rotateBy(rang, mv, p2);

	FdVector3d mvT2 = mvShift;
	mvT2.rotateBy(rang, mv);
	pT22 = pT21 + mvT2 * l;

	FdPoint3d arPT2[] = { pT21, pT22 };

	makeSimpleTube(arPT2, diam, diam, n);




	FdPoint3d pTF1, pTF2;
	pTF1 = cP - mvShift * l;
	pTF2 = cP;

	FdPoint3d arPTF[] = { pTF1, pTF2 };

	makeSimpleTube(arPTF, diam, diam, n);

	return 0;
}

// make Deflektor
short GkiBlockCreator::makeGKI_DEFLEKTOR()
{

	postTransformMesh(ARX_PI / 2, FdVector3d::kYAxis);

	ads_real D, D1, D2, L, A, B, E;


	get_val("d", D);  // 110
	get_val("d1", D1);  // 110
	get_val("d2", D2);  // 110
	get_val("l", L);  // 110
	get_val("A", A);  // 110
	get_val("B", B);  // 110
	get_val("E", E);  // 110

	/*
	if (D == 0)
		D = 110;
	if (D1 == 0)
		D1 = 110;
	if (D2 == 0)
		D2 = 206;

	if (L == 0)
		L = 290;

	if (A == 0)
		A = 150;
	if (B == 0)
		B = D;
	if (E == 0)
		E = A / 2;
	*/

	int n = 4;

	FdPoint3d  cP(0, 0, 0);

	FdVector3d mv = vz;
	FdVector3d mvU = vy;
	FdVector3d mvShift = vx;

	FdPoint3d  p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11;

	if( A == 0)
	{
		p6 = cP;
		p5 = cP - mvU * L / 125 * 35 / 2;
		p4 = p5 - mvU * L / 125 * 35;
		p3 = p4 - mvU * L / 125 * 10;

		p7 = cP + mvU * L / 125 * 35 / 2;
		p8 = p7 + mvU * L / 125 * 35;
		p9 = p8 + mvU * L / 125 * 10;

		FdPoint3d arP[] = { p3, p4, p5, p7, p8, p9 };

		double diam[] = { D, D, D2, D2, D1, D1 };

		makeStraightTube(arP, diam, n, 5, false);

	}
	//cP.set(300, 0, 0);
	else
	{
		p1 = cP - mvU * L / 2;
		p2 = p1 + mvU * L / 136 * 54;

		makeVerySimpleTube(p1, p2, D, n);

		FdPoint3d arP[] = { p3, p4, p5, p7, p8, p9 };


		arP[4] = cP + mvU * L / 2;
		arP[3] = arP[4] - mvU * L / 136 * 5;
		arP[2] = arP[3] - mvU * L / 136 * 26;
		arP[1] = arP[2] - mvU * L / 136 * 30;
		arP[0] = arP[1] - mvU * L / 136 * 54;

		double h = p2.y - arP[0].y;
		double tg = D / 2 / h;
		h = A / 2 / tg;

		arP[1] = arP[0] + mvU * h;

		double tabWidth[] = { B, B, B, B, B };
		double tabHeight[] = { 0, A, A, E, E };
		bool sides[] = { false, true, true, true,
			false, true, true, true,
			false, true, true, true,
			false, true, true, true
		};
		FdVector3d v[] = { mvU, mvU, mvU, mvU, mvU };
		FdVector3d vU[] = { mv, mv, mv, mv, mv };

		bool edges[][4] =
		{
			true, true, true, true,
			true, true, true, true,

			false, false, true, false,
			true, true, true, true,

			false, false, true, false,
			true, true, true, true,

			false, false, true, false,
			true, true, true, true,

			true, true, true, true
		};
		// make without TOP
		makeBox(4, arP, v, vU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		bool sides_top[] = { true, false, false, false,
			                 true, false, false, false,
			                 true, false, false, false,
			                 true, false, false, false,
		};
		// make TOP
		makeBox(4, arP, v, vU, tabWidth, tabHeight, sides_top, false, false, 0, 0, 0);
	}
	return 0;
}


short GkiBlockCreator::makeGKI_CPRS()
{

	//postTransformMesh(ARX_PI / 2, FdVector3d::kYAxis);

	ads_real A, B, L, Lm;

	get_val("a", A);  // 110
	get_val("b", B);  // 110
	get_val("l", L);  // 110
	get_val("lm", Lm);  // 110

	FdPoint3d  cP(0, 0, 0);

	/*
	makeSymbolicCircle(cP, vx, 20);
	makeSymbolicCircle(cP, vy, 20);
	makeSymbolicCircle(cP, vz, 20);
	*/

	FdVector3d mv = -vx; // vz;
	FdVector3d mvU = vy;
	FdVector3d mvShift = vx;// vx;

	FdVector3d mvRot = vz;// vx;

	FdPoint3d
		p1(cP - L / 2 * mv + 10 * mv),
		p2(cP + L / 2 * mv);


	//double rangl = M_PI * -32 / 180.0;
	double rangl = M_PI * 32 / 180.0;

	FdVector3d mv2 = mv;
	mv2.rotateBy(rangl, mvRot);

	FdVector3d mvU2 = mvU;
	mvU2.rotateBy(rangl, mvRot);

	double a = tan(rangl) * B / 2;

	FdPoint3d p3 = p2 + a * mv;


	FdPoint3d arP[] = { p1, p2, p3 };  // center points of tube 1

	FdVector3d arV[] = { mv, mv, mv2 };
	FdVector3d arVU[] = { mvU, mvU, mvU2 };

	double HeigthMax = B / cos(rangl);

	double tabWidth[] = { A, A, A};
	double tabHeight[] = { B, B, HeigthMax };
	bool sides[] = { true, true, true, true,
		                 true, true, true, true };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		false,false,false,false,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(2, arP, arV, arVU, tabWidth, tabHeight, sides, edges, false, false, 0, 0, 0);

	p2 = p1;
	p3 = p2 - 10 * mv;

	FdPoint3d p4 = p3;

	FdPoint3d arP2[] = { p1, p2, p3, p4, p1 };

	FdVector3d arV2[] = { -mv, -mv, -mv, -mv };
	FdVector3d arVU2[] = { mvU, mvU, mvU, mvU };

	double tabWidth2[] = { A, A+10, A+10, A };
	double tabHeight2[] = { B, B+10, B+10, B  };
	bool sides2[] = { true, true, true, true,
					  true, true, true, true,
		              true, true, true, true };

	bool edges2[][4] =
	{
		true, true, true, true,
		
		false, false, false, false,
		true, true, true, true,
		true, true, true, true,
		true, true, true, true,
		false, false, false, false,

		true, true, true, true
	};

	makeBox(3, arP2, arV2, arVU2, tabWidth2, tabHeight2, sides2, edges2, false, false, 0, 0, 0);


	FdPoint3d arP3[] = { p1, p3 };

	FdVector3d arV3[] = { -mv, -mv };
	FdVector3d arVU3[] = { mvU, mvU };

	double tabWidth3[] = { A,  A };
	double tabHeight3[] = { B,  B };
	bool sides3[] = { 
		
		true, true, true, true };

	bool edges3[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};

	makeBox(1, arP3, arV3, arVU3, tabWidth3, tabHeight3, sides3, edges3, false, false, 0, 0, 0);
	
	/*
	makeSymbolicCircle(p1, vx, 10 );
	makeSymbolicCircle(p2, vx, 10 );
	makeSymbolicCircle(p3, vx, 10);

	makeSymbolicCircle(p1, vy, 10);
	makeSymbolicCircle(p2, vy, 10);
	makeSymbolicCircle(p3, vy, 10);

	makeSymbolicCircle(p1, vz, 10);
	makeSymbolicCircle(p2, vz, 10);
	makeSymbolicCircle(p3, vz, 10);

	
	FdPoint3d pL1, pL2;
	pL1 = p2;
	pL2 = pL1 + mv2 * 30;
	makeSymbolicLine(pL1, pL2);
	pL2 = pL1 + mvU2 * 30;
	makeSymbolicLine(pL1, pL2);
	pL2 = pL1 + mvShift * 30;
	//makeSymbolicLine(pL1, pL2);
	
	pL1 = p3;
	pL2 = pL1 + mv2 * 30;
	//makeSymbolicLine(pL1, pL2);
	pL2 = pL1 + mvU2 * 30;
	//makeSymbolicLine(pL1, pL2);
	pL2 = pL1 + mvShift * 30;
	makeSymbolicLine(pL1, pL2);
	*/

	return 0;
}


short GkiBlockCreator::makeGKI_PRSTR45()
{
	ads_real A, B, C, G, H,  L, L3,  Lm;

	ads_real T1_idx, T2_idx, T3_idx;

	get_val("a", A);  
	get_val("b", B);  
	get_val("c", C);  
	get_val("g", G);  
	get_val("h", H);  
	get_val("l", L);  
	get_val("lm", Lm);  

	get_val("l3", L3);  

	get_val("t1_idx", T1_idx);
	get_val("t2_idx", T2_idx);
	get_val("t3_idx", T3_idx);



	double rangl = M_PI * 45 / 180.0;

	double HeigthMax = H / cos(rangl);


	FdPoint3d  cP(0, 0, 0);

	/*
	makeSymbolicCircle(cP, vx, 20);
	makeSymbolicCircle(cP, vy, 20);
	makeSymbolicCircle(cP, vz, 20);
	*/


	FdVector3d mv = -vx; // vz;
	FdVector3d mvU = vy;
	FdVector3d mvShift = vx;// vx;

	FdVector3d mvRot = vz;// vx;

	if (T1_idx == 1) L -= Lm;
	if (T2_idx == 1) L -= Lm;

	FdPoint3d
		p1(cP - L / 2 * mv ),
		p2(cP + L / 2 * mv ),
		p12(cP - HeigthMax / 2 * mv),
		p22(cP + HeigthMax / 2 * mv);

	//if (T1_idx == 1) p1 = p1 + mv * Lm;
	//if (T2_idx == 1) p2 = p2 - mv * Lm;


	FdPoint3d arP[] = { p1, p12, p22, p2 };  // center points of tube 1

	FdVector3d arV[] = { mv, mv, mv, mv };
	FdVector3d arVU[] = { mvU, mvU, mvU, mvU };




	double tabWidth[] = { A, A, A, A };
	double tabHeight[] = { B, B, B, B };
	bool sides[] = { false, true, true, true,
		false, true, false, true,
		false, true, true, true };

	bool edges[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		false, false, false, false,
		true, true, true, true,
		false, false, false, false,
		true, true, true, true,
		true, true, true, true
	};
	// make without TOP
	makeBox(3, arP, arV, arVU, tabWidth, tabHeight, sides, edges, false, false, 0, 0, 0);

	FdPoint3d arP_12[] = { p1, p2 };
	bool sides_12[] = { true, false, false, false };

	bool edges_12[][4] =
	{
		true, false, false, false,
		true, true, false, false,
		true, false, false, false
	};
	// make TOP
	makeBox(1, arP_12, arV, arVU, tabWidth, tabHeight, sides_12, edges_12, false, false, 0, 0, 0);



// рисуем кромку справа
		p2 = p1;
		FdPoint3d p3 = p2 - Lm * mv;

		FdPoint3d p4 = p3;

		FdPoint3d arP2[] = { p1, p2, p3, p4, p1 };

		FdVector3d arV2[] = { -mv, -mv, -mv, -mv };
		FdVector3d arVU2[] = { mvU, mvU, mvU, mvU };

		double tabWidth2[] = { A, A + 10, A + 10, A };
		double tabHeight2[] = { B, B + 10, B + 10, B };
		bool sides2[] = { true, true, true, true,
			true, true, true, true,
			true, true, true, true };

		bool edges2[][4] =
		{
			true, true, true, true,

			false, false, false, false,
			true, true, true, true,
			true, true, true, true,
			true, true, true, true,
			false, false, false, false,

			true, true, true, true
		};
		if (T1_idx == 1)
		{
			makeBox(3, arP2, arV2, arVU2, tabWidth2, tabHeight2, sides2, edges2, false, false, 0, 0, 0);
		}

		FdPoint3d arP3[] = { p1, p3 };

		FdVector3d arV3[] = { -mv, -mv };
		FdVector3d arVU3[] = { mvU, mvU };

		double tabWidth3[] = { A, A };
		double tabHeight3[] = { B, B };
		bool sides3[] = {

			true, true, true, true };

		bool edges3[][4] =
		{
			true, true, true, true,
			true, true, true, true,
			true, true, true, true
		};
		if (T1_idx == 1)
		{
			makeBox(1, arP3, arV3, arVU3, tabWidth3, tabHeight3, sides3, edges3, false, false, 0, 0, 0);
		}


		// рисуем кромку слева
		p1 = cP + L / 2 * mv + mv * Lm;
		p2 = p1;
		p3 = cP + L / 2 * mv;
		p4 = p3;

		FdPoint3d arP4[] = { p1, p2, p3, p4, p1 };
		if (T2_idx == 1)
		{
			makeBox(3, arP4, arV2, arVU2, tabWidth2, tabHeight2, sides2, edges2, false, false, 0, 0, 0);

			FdPoint3d arP5[] = { p1, p3 };
			makeBox(1, arP5, arV3, arVU3, tabWidth3, tabHeight3, sides3, edges3, false, false, 0, 0, 0);
		}



	// рисуем ответвление
	p1 = cP - mvU * B / 2;
	p2 = p1;

	FdVector3d mv2 = mv;
	mv2.rotateBy(rangl, mvRot);

	FdVector3d mvU2 = mvU;
	mvU2.rotateBy(rangl, mvRot);


	//double L3_new = L3 + H / 2;  // так хитро получилось потому что угол 45 градусов. потому только половина ширины.
	double L3_new = 150 + H / 2;  // так хитро получилось потому что угол 45 градусов. потому только половина ширины.
	p3 = p2 + mv2 * L3_new;


	FdPoint3d arP_t[] = { p1, p2, p3 };  // center points of tube 1

	FdVector3d arV_t[] = { -mvU, -mvU, mv2 };
	FdVector3d arVU_t[] = { mv, mv, mvU2 };

	//double tabWidth_t[] = { A, C, C };
	double tabWidth_t[] = { A, G, G };
	double tabHeight_t[] = { HeigthMax, HeigthMax, H };

	bool sides_t[] = { true, true, true, true,
		true, true, true, true };

	bool edges_t[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};

	makeBox(2, arP_t, arV_t, arVU_t, tabWidth_t, tabHeight_t, sides_t, edges_t, false, false, 0, 0, 0);

	/*
	makeSymbolicCircle(p1, vx, 10);
	makeSymbolicCircle(p2, vx, 10);
	makeSymbolicCircle(p3, vx, 10);

	makeSymbolicCircle(p1, vy, 10);
	makeSymbolicCircle(p2, vy, 10);
	makeSymbolicCircle(p3, vy, 10);

	makeSymbolicCircle(p1, vz, 10);
	makeSymbolicCircle(p2, vz, 10);
	makeSymbolicCircle(p3, vz, 10);
	*/



	// рисуем кромку на ответвлении

	p2 = p1 = p3;
	p3 = p2 + Lm * mv2;

	p4 = p3;

	FdPoint3d arP_t2[] = { p1, p2, p3, p4 };

	FdVector3d arV_t2[] = { mv2, mv2, mv2, mv2 };
	FdVector3d arVU_t2[] = { mvU2, mvU2, mvU2, mvU2 };

	double tabWidth_t2[] = { G, G + 10, G + 10, G };
	double tabHeight_t2[] = { H, H + 10, H + 10, H };
	bool sides_t2[] = { true, true, true, true,
		true, true, true, true,
		true, true, true, true };

	bool edges_t2[][4] =
	{
		true, true, true, true,

		false, false, false, false,
		true, true, true, true,
		true, true, true, true,
		true, true, true, true,
		false, false, false, false,

		true, true, true, true
	};

	if (T3_idx == 1)
	{
		makeBox(3, arP_t2, arV_t2, arVU_t2, tabWidth_t2, tabHeight_t2, sides_t2, edges_t2, false, false, 0, 0, 0);
	}

	FdPoint3d arP_t3[] = { p1, p3 };

	FdVector3d arV_t3[] = { mv2, mv2 };
	FdVector3d arVU_t3[] = { mvU2, mvU2 };

	double tabWidth_t3[] = { G, G };
	double tabHeight_t3[] = { H, H };
	bool sides_t3[] = {

		true, true, true, true };

	bool edges_t3[][4] =
	{
		true, true, true, true,
		true, true, true, true,
		true, true, true, true
	};

	if (T3_idx == 1)
	{
		makeBox(1, arP_t3, arV_t3, arVU_t3, tabWidth_t3, tabHeight_t3, sides_t3, edges_t3, false, false, 0, 0, 0);
	}

	

	return 0;
}

short GkiBlockCreator::makeGKI_STE45()
{
	// postTransformMesh(ARX_PI / -2, FdVector3d::kYAxis);

	ads_real D, D1, L1;
	get_val("d3", D);
	get_val("d1", D1);
	get_val("l5", L1);

	FdPoint3d  cP(0, 0, 0);

	int n = 4;

	double diam1 = D1;
	double diam2 = D;
	double length2 = L1;

	double rangl = M_PI * 45 / 180.0;

	length2 += diam2 / 2 + diam1 / 2 * SQRT_2;


	FdPoint3d p1;

	p1.set(-diam1/2 - diam2 / 2, 0, -diam1 / 2);
	double mainTubeData[3] = { diam1, diam1, diam1 * 3 };
	double interPos[2] = { diam1 + diam2 / 2, 0 };
	double interData[3] = { length2, diam2, diam2 };
	double angles[3] = { 45, 90, 0 };
	int complex[2] = { n, n };
	bool bools[2] = { false, true };  // omit the main tube
	makeTubeToTubeIntersection(p1, vx, mainTubeData, interPos, interData, angles, complex, bools);

	return 0;

	/*
	makeSymbolicCircle(cP, vx, 10);
	makeSymbolicCircle(cP, vy, 10);
	makeSymbolicCircle(cP, vz, 10);

	FdVector3d mv = vx; // vz;
	FdVector3d mvU = vy;
	FdVector3d mvShift = vx;// vx;

	FdVector3d mvRot = vz;// vx;

	double rangl = M_PI * 45 / 180.0;


	//double HeigthMax = H / cos(rangl);

	double diam1 = D1;
	double diam2 = D;
	double length1 = D1 * 3;// diam2 / cos(rangl) + 1;
	double length2 = L1 * 2;

	//length1 *= 3.0;

	cP = cP - mv * length1 / 2 + mv * diam2 / 2;

	cP = cP - mvRot * diam1 / 2;

	makeSymbolicCircle(cP, vx, 10);
	makeSymbolicCircle(cP, vy, 10);
	makeSymbolicCircle(cP, vz, 10);

	double angle = 45;

	int n = 4;

	FdPoint3d p1, p2, p3, p4;
	double tubeData[2] = { diam1, length1 };
	
	double tubeData2[3] = { diam1, diam1, length1 };
	//double interPos[2] = { length1 / 2 + diam1 / 2, 0 };
	double interPos[2] = { length1/2, 50 };
	
	double interTubeData[4] = { diam2, length2, tubeData[1] / 2 - diam1 / 2, 0 };
	
	double interTubeData2[3] = { length2, diam2, diam2 };
	double angles[2] = { angle, 270 };
	//double angles2[3] = { angle, 90, 270 };
	double angles2[3] = {angle, 90, 0 };
	int complex[2] = { n, n };
	bool bools[2] = { false, false };  // omit the main tube
		//---define the directional vector for both tee intersection functions
	p1 = cP; // .set(-(length1 + length3 * 2) / 2, 0, 0);

	makeTubeToTubeIntersection(p1, mv, tubeData2, interPos, interTubeData2, angles2, complex, bools);

	//return 0;
	//makeTubeToTubeIntersection2(p1, mv, mvU, tubeData, interTubeData, angles, n, false);



	return 0;

	FdVector3d mv2 = mvU;// mv;
	mv2.rotateBy(rangl, mvRot);

	FdVector3d mvU2 = -mv;// mvU;
	mvU2.rotateBy(rangl, mvRot);

	p1 = p1 + mv * length1;
	//p1 = p1 + mv * (length1 / 2 - diam1 / 2);
	//p1 = p1 + mvU * diam1 / 2;
	p1 = p1 + mv2 * length2; // (length2 - diam1 / 2); // - tubeData[1] / 2 - diam1 / 2);

	p2 = p1 + mv2 * 10;

	FdPoint3d arP[] = { p1, p2 };
	makeVerySimpleTube(arP, diam2, 4);

	FdPoint3d arP2[] = { p1, p1, p2, p2 };
	double diam[] = { diam2, diam2 + 10, diam2 + 10, diam2 };

	//FdVector3d arV2[] = { mv2, mv2, mv2, mv2 };
	
	makeUniVectorTube(arP2, mv2, diam, 4, 3);

	//makeStraightTube(arP2, diam, 4, 3);

	//makeElbowedTube()

	return 0;
	*/
}



short GkiBlockCreator::makeGKI_OKRRP()
{
	ads_real D, D1, S, A, H1, H2;

	ads_real N, cIdx, conType;

	get_val("d", D);
	get_val("d1", D1);
	get_val("s", S);
	get_val("A/A", A);
	get_val("h1", H1);
	get_val("h2", H2);

	get_val("n", N);

	get_val("con_idx", cIdx);

	get_val("_conn", conType);
	
	char * pConType;
	get_val("_conn", pConType);
	//Muff connection
	//Flange

	FdPoint3d  cP(0, 0, 0);

	FdVector3d mv = vy; // vz;
	FdVector3d mvU = vz;
	FdVector3d mvShift = vx;// vx;

	FdVector3d mvRot = vz;// vx;

	if (cIdx == 3)
	{
		FdPoint3d p1, p2;
		p1 = cP - mv * (H1 + H2 + S) / 2;
		p2 = cP + mv * (H1 + H2 + S) / 2;

		FdPoint3d arP[] = { p1, p2 };

		makeVerySimpleTube(arP, D, 4);


		arP[0] = p1 + mv * H2;
		arP[1] = arP[0] + mv * S;

		FdVector3d arV[] = { mv, mv };
		FdVector3d arVU[] = { mvU, mvU };

		double tabWidth[] = { A, A };
		double tabHeight[] = { A, A };
		bool sides[] = {

			true, true, true, true };

		bool edges[][4] =
		{
			true, true, true, true,
			true, true, true, true,
			true, true, true, true
		};

		makeBox(1, arP, arV, arVU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		p1 = p1 + mv * (H2 + S + H1 / 4);
		p2 = p1 + mv * H1 / 2;

		FdPoint3d p3 = p2 + mv * H1 / 8;

		FdPoint3d arP2[] = { p1, p2, p3 };

		double diam[] = { D1, D, D + 2 };

		makeUniVectorTube(arP2, mv, diam, 4, 1);

		makeSymbolicCircle(p3, mv, D);
	}
	else
	{
		double rangl = M_PI * 10 / 180.0;

		FdVector3d mv2 = mv;
		mv2.rotateBy(rangl, mvRot);

		FdVector3d mvU2 = mvU;
		mvU2.rotateBy(rangl, mvRot);


		FdPoint3d p1, p2;
		//p1 = cP - mv * (H1 + H2) / 2;
		//p2 = cP + mv * (H1 + H2) / 2;

		p1 = cP - mv * (H1 + H2 + S) / 2;
		p2 = cP + mv * (H1 + H2 + S) / 2;

		if (*pConType == 'F')
			p2 = p2 - mv * 10;
		else
			p1 = p1 + mv * 20;

		FdPoint3d arP[] = { p1, p2 };

		makeVerySimpleTube(arP, D, 4);

		double a = tan(rangl) * D / 2;

		arP[0] = p1 + mv * H2 - mv * a;
		arP[1] = arP[0] + mv2 * S;//  (S / cos(rangl));

		FdVector3d arV[] = { mv2, mv2 };
		FdVector3d arVU[] = { mvU2, mvU2 };

		double tabWidth[] = { A, A };
		double tabHeight[] = { A, A };
		bool sides[] = {

			true, true, true, true };

		bool edges[][4] =
		{
			true, true, true, true,
			true, true, true, true,
			true, true, true, true
		};

		makeBox(1, arP, arV, arVU, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);

		if (*pConType == 'F')
		{
			p1 = p2; 
			//p1 = cP + mv * (H1 + H2) / 2;
			p2 = p1 + mv * 10;

			FdPoint3d arP[] = { p1, p2 };
			makeVerySimpleTube(arP, D, 4);

			FdPoint3d arP2[] = { p1, p1, p2, p2 };
			double diam[] = { D, D + 20, D + 20, 0 };

			makeUniVectorTube(arP2, mv, diam, 4, 3);
		}
		else
		{
			//p1 = cP - mv * (H1 + H2) / 2;
			p2 = p1; 
			p1 = p1 - mv * 20;

			FdPoint3d arP[] = { p1, p2 };
			makeVerySimpleTube(arP, D, 4);

			FdPoint3d arP2[] = { p1, p1, p2, p2 };
			double diam[] = { D, D + 10, D + 10, D };

			makeUniVectorTube(arP2, mv, diam, 4, 3);
		}
	}

	return 0;
}

short GkiBlockCreator::makeGKI_PDB()
{
	ads_real d, axa, type_idx, h, L, a_geo;

	get_val("d", d);
	get_val("axa", axa);
	get_val("type_idx", type_idx);
	get_val("h", h);
	get_val("L", L);
	get_val("a_geo", a_geo);

	int n = 10;

	FdPoint3d cp1( 0, 0, 0 ), cp2( 0, 0, 50 );
	FdPoint3d cp[4] = { cp1, cp1, cp2, cp2 };
	FdVector3d v[4] = { vz, vz, vz, vz };
	double width[4] = { a_geo + 25, a_geo + 25, a_geo, a_geo };
	double height[4] = { a_geo + 25, a_geo + 25,  a_geo, a_geo };
	bool sides[8] = { true, true, true, true, true, true, true, true };
	bool conn[2] = { false, false };

	double tdiam[3] = { d, d, 0 };
	double tdiam2[3] = { d, d, h };
	double RecHeight[2] = { a_geo, a_geo };

	if( type_idx == 1 )
	{
		makeBox(2, cp, v, width, height, sides, conn, false, false);
		makeRectToTubeTransition(cp1, vz, vx, width, cp1, tdiam, n);
		makeRectToTubeTransition(cp2, vz, vx, RecHeight, cp2, tdiam2, n);
	}
	else
	{
		double tdiam3[3] = { d, d, - L + h + 50 };
		makeBox(2, cp, v, width, height, sides, conn, false, false);
		makeRectToTubeTransition(cp1, vz, vx, width, cp1, tdiam3, n);
		makeRectToTubeTransition(cp2, vz, vx, RecHeight, cp2, tdiam2, n);
	};

	return 0;
}
#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

#define GLEDiffusersAndGrills SmkGenBlockCreator


#define HOW_COMPLEX 10
double cpx = HOW_COMPLEX;

// #define DETAILED
/* If DETAILED is defined, detailed version of all
   grills is used. Otherwise all grills use only
   symbolic cross in their representation. */

/////////////////////////////////////BEGINNING OF GENERAL DIFFUSERS AND GRILLS FUNCTIONS///////////////////////////////////
void GLEDiffusersAndGrills::makeGrCD1(double D, double D1, double D2, double m, double n, double h, double bH)
{
	char *pb_opt;
	get_val("pb_opt", pb_opt);
	if( pb_opt && pb_opt[0] == 'b' )
		pb_opt = NULL;

#ifdef DETAILED
	FdPoint3d p1(0, 0, 0), p2(0, 0, bH);
	//--- make the connecting flange
	// double flangeSize = 52;  // default size in general library
	makeVerySimpleTube(p1, p2, D, n);
	addCircularConnector(p1);

	// one cute grill type3
	makeGrillType3(p2, vz, D1, D, D2, n, m, bH, h);
#else
	FdPoint3d p1(0, 0, 0);
	makeCircSimpleGrill(p1, vz, D, n, pb_opt ? false : true);
#endif

	// adding box
	if( pb_opt )
	{
		if( pb_opt[2] == 's' )
		{
			// z króæcem bocznym - DNK
			double L = D + 150;
			double H = D + 150;
			double Na = 40, T = 90;
			double BD = Na + 250;
			double Td = 50;
			double Na1 = D, T1 = 40;

			long N;  double alfa = 7;
			get_val("L", L);  get_val("D", Na);  get_val("H", H);
			get_val("T", T);  get_val("bd", BD);  get_val("Td", Td);
			get_val("T1", T1);  // get_val("Na1", Na1);
			get_val("alfa", alfa);  get_val("k", N);

			H = L;  Na1 = D;
			FdPoint3d p1(0, 0, -T1);
			makeDNK(p1, -vz, -vx, H, L, Na, Na1, BD, T, T1, alfa, Td + Na / 2, N);
		}
		if( pb_opt[2] == 't' )
		{
			// z kroccem górnym - DMK
			double L = D + 150;
			double H = D + 150;
			double Na = 40, T = 90;
			double BD = Na + 250;
			double Na1 = D, T1 = 40;

			long N;  double alfa = 7;
			get_val("L", L);  get_val("D", Na);  get_val("H", H);
			get_val("T", T);  get_val("bd", BD);  get_val("T1", T1);
			get_val("alfa", alfa);  get_val("k", N);

			H = L;  Na1 = D;
			FdPoint3d p1(0, 0, -T1);
			makeDMK(p1, -vz, -vy, L, H, Na, Na1, BD, T, T1, alfa, N);
		}
	}
}

// bez skrzynki
void GLEDiffusersAndGrills::makeGrCG1(double L, double H, double D, double d1, double side)
{
	// if H was bigger than D, then a strange result
	// would appear, so we must cheat and set D = H.
	if( H > D )  D = H;

	// we have a 4 boxes and a grill here:)
	double x, y, h = H / 2, l = L / 2, z, alfa;
	D = D / 2.0;
	x = sqrt(D * D - h * h);
	y = D - x;
	alfa = atan(y / (H / 3.0));
	z = tan(alfa) * side;

	// left side
	FdPoint3d p1(-l + side / 2, h, d1 / 2.0),
		p2(-l + side / 2, h - H / 3.0, d1 / 2.0 + y / 2),
		p3(-l + side / 2, h - 2 * H / 3.0, d1 / 2.0 + y / 2),
		p4(-l + side / 2, -h, d1 / 2.0);
	FdPoint3d centralPointsLS[4] = { p1, p2, p3, p4 };
	FdVector3d vectorsLS [4] = { -vy, -vy, -vy, -vy };
	double tabWidthLS[4] = { d1, y + d1, y + d1, d1 };
	double tabHeightLS[4] = { side, side, side, side };
	bool sidesLS[12] = { true, true, true, true, true, true, true, true, true, true, true, true };
	bool conLS[2] = { false, false };
	makeBox(3, centralPointsLS, vectorsLS, tabWidthLS, tabHeightLS, sidesLS, conLS, true, true);

	// right side
	p1.set(l - side / 2, h, d1 / 2.0);
	p2.set(l - side / 2, h - H / 3.0, d1 / 2.0 + y / 2);
	p3.set(l - side / 2, h - 2 * H / 3.0, d1 / 2.0 + y / 2);
	p4.set(l - side / 2, -h, d1 / 2.0);
	FdPoint3d centralPointsRS[4] = { p1, p2, p3, p4 };
	FdVector3d vectorsRS[4] = { -vy, -vy, -vy, -vy };
	double tabWidthRS[4] = { d1, y + d1, y + d1, d1 };
	double tabHeightRS[4] = { side, side, side, side };
	bool sidesRS[12] = { true, true, true, true, true, true, true, true, true, true, true, true };
	bool conRS[2] = { false, false };
	makeBox(3, centralPointsRS, vectorsRS, tabWidthRS, tabHeightRS, sidesRS, conRS, true, true);

	// up side
	p1.set(0, h,        d1 / 2.0);
	p2.set(0, h - side, d1 / 2.0 + z / 2.0);
	FdPoint3d centralPointsUS[2] = { p1, p2 };
	FdVector3d vectorsUS[2] = { -vy, -vy };
	double tabWidthUS[2] = { d1, d1 + z };
	double tabHeightUS[2] = { L - 2 * side, L - 2 * side };
	bool sidesUS[12] = { true, true, true, true };
	bool conUS[2] = { false, false };
	makeBox(1, centralPointsUS, vectorsUS, tabWidthUS, tabHeightUS, sidesUS, conUS, true, true);

	// down side
	p1.set(0, -h,        d1 / 2.0);
	p2.set(0, -h + side, d1 / 2.0 + z / 2.0);
	FdPoint3d centralPointsDS[2] = { p1, p2 };
	FdVector3d vectorsDS[2] = { -vy, -vy };
	double tabWidthDS[2] = { d1, d1 + z };
	double tabHeightDS[2] = { L - 2 * side, L - 2 * side };
	bool sidesDS[12] = { true, true, true, true };
	bool conDS[2] = { false, false };
	makeBox(1, centralPointsDS, vectorsDS, tabWidthDS, tabHeightDS, sidesDS, conDS, true, true);

#ifdef DETAILED
	double ln, Pl = 20;
	alfa = atan(30 / Pl);
	alfa = alfa * 180 / ARX_PI;
	ln = floor( (L - 2 * side) / Pl );
	ln = ln - 1;

	p1.set(0, 0, d1);
	makeRectGrillType4(p1, -vz, vx, H - 2 * side, L - 2 * side, 30, alfa, 1, ln, 1);
#else
	p1.set(0, 0, d1);
	FdVector3d upv = vx, cv = vy;
	double h1 = (H - 2 * side) / 2, l1 = (L - 2 * side) / 2;
	p2 = p1 + l1 * upv + h1 * cv;
	p3 = p1 - l1 * upv - h1 * cv;
	makeSymbolicLine(p2, p3);

	p2 = p1 - l1 * upv + h1 * cv;
	p3 = p1 + l1 * upv - h1 * cv;
	makeSymbolicLine(p2, p3);
#endif
}

// bez skrzynki
void GLEDiffusersAndGrills::makeGrJD1(double length, double diam, double diam1, double diam2, double r, double n)
{
	// make the bulb
	double upperOffset, lowerOffset, upperTheta, lowerTheta;
	lowerTheta = asin(diam2 / (2 * r));
	upperTheta = asin(diam1 / (2 * r));
	lowerOffset = r * cos(lowerTheta);
	upperOffset = r * cos(upperTheta);
	lowerTheta *= (180 / ARX_PI);
	upperTheta *= (180 / ARX_PI);
	if( lowerOffset < 0 )
		lowerOffset = -lowerOffset;
	if( upperOffset < 0 )
		upperOffset = -upperOffset;

	FdPoint3d p1(0, 0, lowerOffset), p2;
	double latAngles[2] = { lowerTheta, 180 - upperTheta };
	double longAngles[2] = { 0, 360 };
	double diams[3] = { r * 2, r * 2, r * 2 };
	int complexities[2] = { max(1, n / 2), 4 * n };
	makeSpheroidSection(p1, vz, latAngles, longAngles, diams, complexities);

	p1.set(0, 0, 0);
	addCircularConnector(p1);

	// make the spout
	p1.set(0, 0, lowerOffset + upperOffset);  p2.set(0, 0, lowerOffset + upperOffset + length);
	FdPoint3d centers[2] = { p1, p2 };
	makeSimpleTube(centers, diam1, diam, n);
	drawAsThinArc(p1);
	addCircularConnector(p2);
}

void GLEDiffusersAndGrills::makeGrLD1(double L, double H, double n, double a)
{
	char *pb_opt;
	get_val("pb_opt", pb_opt);
	if( pb_opt && pb_opt[0] == 'b' )
		pb_opt = NULL;

#ifdef DETAILED
	FdPoint3d centralPoint(0, 0, 10);
	makeGrillType6(centralPoint, -vz, vy, L, H, n, a);

	//--- Make the connecting box
	FdPoint3d p1( 0, 0, 0), p2(0, 0, 10);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabHeight[2] = { L, L };
	double tabWidth[2] = { H, H };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);
#else
	FdPoint3d p1( 0, 0, 0);
	makeRectSimpleGrill(p1, vz, H, L, pb_opt ? false : true);
#endif

	// adding box
	if( pb_opt )
	{
		if( pb_opt[2] == 's' )
		{
			// z króæcem bocznym - BBL
			double Na = 150, T = 90;
			double BD = Na + 150;
			double Td = BD - 40 - Na / 2;

			long N = 1;
			get_val("D", Na);  get_val("T", T);  get_val("bd", BD);
			get_val("Td", Td);  get_val("k", N);

			FdPoint3d p1(0, 0, 0);
			makeBBL(p1, -vz, -vy, L, H, Na, BD, T, Td + Na / 2, N);
		}
		if( pb_opt[2] == 't' )
		{
			// z kroccem górnym - BBF
			double Na = 150, T = 90;
			double BD = Na + 150;

			long N = 1;
			get_val("D", Na);  get_val("T", T);
			get_val("bd", BD);  get_val("k", N);

			FdPoint3d p1( 0, 0, 0);
			makeBBF(p1, -vz, -vy, L, H, Na, BD, T, N);
		}
	}
}

void GLEDiffusersAndGrills::makeGrPPD1(double L, double H)
{
	char *pb_opt;
	get_val("pb_opt", pb_opt);
	if( pb_opt && pb_opt[0] == 'b' )
		pb_opt = NULL;

#ifdef DETAILED
	FdPoint3d centralPoint( 0, 0, 10 );
	makeGrillType6(centralPoint, vz, vy, L, H, 2, 0);

	//--- Make the connecting box
	FdPoint3d p1(0, 0, 0), p2(0, 0, 10);
	FdPoint3d centralPoints[2] = { p1, p2 };
	double tabHeight[2] = { L, L };
	double tabWidth[2] = { H, H };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);
#else
	FdPoint3d p1( 0, 0, 0);
	makeRectSimpleGrill(p1, vz, H, L, pb_opt ? false : true);
#endif

	// adding box
	if( pb_opt )
	{
		if( pb_opt[2] == 's' )
		{
			// z króæcem bocznym - BPNL
			double Na = 150, T = 90;
			double BD = Na + 150;
			double Td = BD - 40 - Na / 2;

			long N;  double alfa = 7;
			get_val("D", Na);  get_val("T", T);  get_val("bd", BD);
			get_val("Td", Td);  get_val("alfa", alfa);  get_val("k", N);
			FdPoint3d p1( 0, 0, 0);
			makeBPNL(p1, -vz, -vx, H, L, Na, BD, T, Td + Na / 2, alfa, N);
		}
		if( pb_opt[2] == 't' )
		{
			// z kroccem górnym - BPNF
			double Na = 150, T = 90;
			double BD = Na + 150;

			long N;  double alfa = 7;
			get_val("D", Na);  get_val("T", T);  get_val("bd", BD);
			get_val("alfa", alfa);  get_val("k", N);

			FdPoint3d p1(0, 0, 0);
			makeBPNF(p1, -vz, -vy, L, H, Na, BD, T, alfa, N);
		}
	}
}

void GLEDiffusersAndGrills::makeGrRD1(double L, double H, double frame, double thickness, double alfa)
{
	char *pb_opt;
	get_val("pb_opt", pb_opt);
	if( pb_opt && pb_opt[0] == 'b' )
		pb_opt = NULL;

#ifdef DETAILED
	double r = 5, ln = 3, Pl = 22.5, ft = 7;
	double x = thickness * tan(alfa * M_PI / 180);

	// get vairables from .pnr file
	double A = L + 2 * x;
	double B = H + 2 * x;

	double C = L + 2 * x + 2 * frame;
	double E = H + 2 * x + 2 * frame;

	// calculate variables
	ln = floor( min(A, B) / (2 * Pl) );
	ln = ln - 1;

	// grill
	FdPoint3d cp(0, 0, thickness);
	makeRectGrillType1(cp, -vz, vy, A, B, thickness, alfa, r, ln, 1);

	FdPoint3d p1(0, 0, thickness), p2(0, 0, thickness - ft);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	FdVector3d v[4] = { -vz, -vz, -vz, -vz };
	FdVector3d upv[4] = { vy, vy, vy, vy };
	double tabWidth[4] = { A, C, C, A };
	double tabHeight[4] = { B, E, E, B };
	bool sides[12] = { true, true, true, true, true, true, true, true, true, true, true, true };
	makeBox(3, p, v, upv, tabWidth, tabHeight, sides, false, false, 5, 5, 0);
#else
	FdPoint3d p1( 0, 0, 0);
	makeRectSimpleGrill(p1, vz, H, L, pb_opt ? false : true);
#endif

	// adding box
	if( pb_opt )
	{
		if( pb_opt[2] == 's' )
		{
			// z króæcem bocznym - BPNL
			double Na = 150, T = 90;
			double BD = Na + 150;
			double Td = BD - 40 - Na / 2;

			long N;  double alfa = 7;
			get_val("D", Na);  get_val("T", T);  get_val("bd", BD);
			get_val("Td", Td);  get_val("alfa", alfa);  get_val("k", N);

			FdPoint3d p1(0, 0, 0);
			makeBPNL(p1, -vz, -vx, H, L, Na, BD, T, Td + Na / 2, alfa, N);
		}
		if( pb_opt[2] == 't' )
		{
			// z kroccem górnym - BPNF
			double Na = 150, T = 90;
			double BD = Na + 150;

			long N;  double alfa = 7;
			get_val("D", Na);  get_val("T", T);  get_val("bd", BD);
			get_val("alfa", alfa);  get_val("k", N);

			FdPoint3d p1(0, 0, 0);
			makeBPNF(p1, -vz, -vy, L, H, Na, BD, T, alfa, N);
		}
	}
}

void GLEDiffusersAndGrills::makeGrRG1(double L, double H, double frame, double thickness, double alfa)
{
	char *pb_opt;
	get_val("pb_opt", pb_opt);
	if( pb_opt && pb_opt[0] == 'b' )
		pb_opt = NULL;

#ifdef DETAILED
	double r = 5, ln = 3, Pl = 22.5, ft = 7;
	double x = thickness * tan(alfa * M_PI / 180);

	// get vairables from .pnr file
	double A = L + 2 * x;
	double B = H + 2 * x;

	double C = L + 2 * x + 2 * frame;
	double E = H + 2 * x + 2 * frame;

	// calculate variables
	alfa = atan(thickness / Pl);
	alfa = alfa * 180 / ARX_PI;
	ln = floor( min(A, B) / Pl );
	ln = ln - 1;

	// grill
	FdPoint3d cp(0, 0, 0);
	makeRectGrillType4(cp, -vz, vy, A, B, thickness, alfa, r, ln, 1);

	FdPoint3d p1(0, 0, 0), p2(0, 0, -ft);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	FdVector3d v[4] = { -vz, -vz, -vz, -vz };
	FdVector3d upv[4] = { vy, vy, vy, vy };
	double tabWidth[4] = { A, C, C, A };
	double tabHeight[4] = { B, E, E, B };
	bool sides[12] = { true, true, true, true, true, true, true, true, true, true, true, true };
	makeBox(3, p, v, upv, tabWidth, tabHeight, sides, false, false, 5, 5, 0);
#else
	FdPoint3d p1( 0, 0, 0);
	makeRectSimpleGrill(p1, vz, H, L, pb_opt ? false : true);
#endif

	// adding box
	if( pb_opt )
	{
		if( pb_opt[2] == 's' )
		{
			// z króæcem bocznym - BBL
			double Na = 150, T = 90;
			double BD = Na + 150;
			double Td = BD - 40 - Na / 2;

			long N = 1;
			get_val("D", Na);  get_val("T", T);  get_val("bd", BD);
			get_val("Td", Td);  get_val("k", N);

			FdPoint3d p1( 0, 0, 0);
			makeBBL(p1, -vz, -vy, L, H, Na, BD, T, Td + Na / 2, N);
		}
		if( pb_opt[2] == 't' )
		{
			// z kroccem górnym - BBF
			double Na = 150, T = 90;
			double BD = Na + 150;

			long N = 1;
			get_val("D", Na);  get_val("T", T);
			get_val("bd", BD);  get_val("k", N);

			FdPoint3d p1(0, 0, 0);
			makeBBF(p1, -vz, -vy, L, H, Na, BD, T, N);
		}
	}
}

void GLEDiffusersAndGrills::makeGrSCD1(double D, double D1, double D2, double m, double hW, double alfa, double n)
{
	char *pb_opt;
	get_val("pb_opt", pb_opt);
	if( pb_opt && pb_opt[0] == 'b' )
		pb_opt = NULL;

#ifdef DETAILED
	//--- Make the connecting flange
	double flangeSize = 20;  // default size in general library
	FdPoint3d p1(0, 0, 0), p2( 0, 0, flangeSize);
	makeVerySimpleTube(p1, p2, D, n);
	addCircularConnector(p1);

	// one cute grill
	makeGrillType4(p2, vz, vy, D1, D, D2, alfa, hW, n, m, false);
#else
	FdPoint3d p1(0, 0, 0);
	makeCircSimpleGrill(p1, vz, D, n, pb_opt ? false : true);
#endif

	// adding box
	if( pb_opt )
	{
		if( pb_opt[2] == 's' )
		{
			// z króæcem bocznym - DNK
			double L = D + 150;
			double H = D + 150;
			double Na = 40, T = 90;
			double BD = Na + 250;
			double Td = 50;
			double Na1 = D, T1 = 40;

			long N;  double alfa = 7;
			get_val("L", L);  get_val("D", Na);  get_val("H", H);
			get_val("T", T);  get_val("bd", BD);  get_val("Td", Td);
			get_val("T1", T1);  // get_val("Na1", Na1);
			get_val("alfa", alfa);  get_val("k", N);

			Na1 = D;
			FdPoint3d p1(0, 0, -T1);
			makeDNK(p1, -vz, -vx, H, L, Na, Na1, BD, T, T1, alfa, Td + Na / 2, N);
		}
		if( pb_opt[2] == 't' )
		{
			// z kroccem górnym - DMK
			double L = D + 150;
			double H = D + 150;
			double Na = 40, T = 90;
			double BD = Na + 250;
			double Na1 = D, T1 = 40;

			long N;  double alfa = 7;
			get_val("L", L);  get_val("D", Na);  get_val("H", H);
			get_val("T", T);  get_val("bd", BD);  get_val("T1", T1);
			get_val("alfa", alfa);  get_val("k", N);

			Na1 = D;
			FdPoint3d p1(0, 0, -T1);
			makeDMK(p1, -vz, -vy, L, H, Na, Na1, BD, T, T1, alfa, N);
		}
	}
}

void GLEDiffusersAndGrills::makeGrSRD1(double L, double H, double alfa, double m, double hW, double n)
{
	char *pb_opt;
	get_val("pb_opt", pb_opt);
	if( pb_opt && pb_opt[0] == 'b' )
		pb_opt = NULL;

#ifdef DETAILED
	// one cute grill
	FdPoint3d p1(0, 0, 10), p2(0, 0, 0);
	makeGrillType4(p1, vz, vy, min(L, H) / 2.0, min(L, H), min(L, H) + 100, alfa, hW, n, m, true, L, H);

	//--- make the connecting box
	FdPoint3d centralPoints[2] = { p2, p1 };
	double tabHeight[2] = { L, L };
	double tabWidth[2] = { H, H };
	makeBox(1, centralPoints, tabWidth, tabHeight, false);

	bool sides[4] = { true, true, true, true };
	addEraseRect(p1, vz, vy, H, L, sides);
#else
	FdPoint3d p1( 0, 0, 0);
	makeRectSimpleGrill(p1, vz, H, L, pb_opt ? false : true);
#endif

	// adding box
	if( pb_opt )
	{
		if( pb_opt[2] == 's' )
		{
			// z króæcem bocznym - BPNL
			double Na = 150, T = 90;
			double BD = Na + 150;
			double Td = BD - 40 - Na / 2;

			long N;  double alfa = 7;
			get_val("D", Na);  get_val("T", T);  get_val("bd", BD);
			get_val("Td", Td);  get_val("alfa", alfa);  get_val("k", N);

			FdPoint3d p1(0, 0, 0);
			makeBPNL(p1, -vz, -vx, H, L, Na, BD, T, Td + Na / 2, alfa, N);
		}
		if( pb_opt[2] == 't' )
		{
			// z kroccem górnym - BPNF
			double Na = 150, T = 90;
			double BD = Na + 150;

			long N;  double alfa = 7;
			get_val("D", Na);  get_val("T", T);  get_val("bd", BD);
			get_val("alfa", alfa);  get_val("k", N);

			FdPoint3d p1( 0, 0, 0);
			makeBPNF(p1, -vz, -vy, L, H, Na, BD, T, alfa, N);
		}
	}
}

void GLEDiffusersAndGrills::makeGrVV1(double D1, double D2, double D3, double h, double n)
{
	FdPoint3d p1(0, 0, 0);
	makeGrillType2(p1, vz, D1, D2, D3, n, h, 10, true);
	// Note: Hlr line info handled by primitive.
}
/////////////////////////////////////END OF GENERAL DIFFUSERS AND GRILLS FUNCTIONS///////////////////////////////////

// Boxes to this grills
// Additional functions
void GLEDiffusersAndGrills::makeBBF(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Hs, double Na, double Ws, double T, int N)
{
	FdPoint3d p1, p2;
	FdPoint3d p[2];
	FdVector3d v = normal;
	FdVector3d upv = upVector;
	FdVector3d cv = v.crossProduct(upv);
	FdVector3d vector[2] = { v, v };
	FdVector3d upvector[2] = { upv, upv };
	double width[2] = { Ls, Ls };
	double height[2] = { Hs, Hs };
	bool sides[4] = { true, true, true, true };

	p1 = cp;
	p2 = cp + v * Ws;
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, vector, upvector, width, height, sides, false, false, 5, 5, 30);

	FdPoint3d tp;
	for( int i = 0; i < N; i++ )
	{
		p1 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * i + (Ls / N) / 2 );
		tp = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * i + (Ls / N) / 2 );
		double heightWidth[2] = { Hs, Ls / N };
		double tubeParameters[3] = { Na, Na, T };
		makeRectToTubeTransition(p1, v, upv, heightWidth, tp, tubeParameters, cpx);
	}

	if( N > 1 )
		for( int i = 0; i < N - 1; i++ )
		{
			p1 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) + upv * Hs / 2;
			p2 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) - upv * Hs / 2;
			addEraseLine(p1, p2);
		}

	/****************************Copy/create Insulation vairables*******************/
	double size, copyLs = Ls, copyHs = Hs, copyNa = Na, copyWs = Ws, copyT = T;

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		Ls += 2 * size;
		Hs += 2 * size;
		Na += 2 * size;
		Ws += size;
		T -= size;

		FdPoint3d p1, p2;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls };
		double height[2] = { Hs, Hs };
		bool sides[4] = { true, true, true, true };

		p1 = cp;
		p2 = cp + v * Ws;
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, false, (size > 20)?0:5, 5, 20 - size);

		FdPoint3d tp;
		for( int i = 0; i < N; i++ )
		{
			p1 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * i + (Ls / N) / 2 );
			tp = cp + v * Ws + cv * ( -(Ls - 2 * size) / 2 + ((Ls - 2 * size) / N) * i + ((Ls - 2 * size) / N) / 2 );
			double heightWidth[2] = { Hs, Ls / N };
			double tubeParameters[3] = { Na, Na, T };
			makeRectToTubeTransition(p1, v, upv, heightWidth, tp, tubeParameters, cpx);

			tp += v * T;
			makeFlatRing(tp, v, Na, Na - 2 * size, cpx);
		}

		if( N > 1 )
			for( int i = 0; i < N - 1; i++ )
			{
				p1 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) + upv * Hs / 2;
				p2 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) - upv * Hs / 2;
				addEraseLine(p1, p2);
			}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}

	/**********************************Recover variables*******************************/
	Ls = copyLs;  Hs = copyHs;  Na = copyNa;  Ws = copyWs;  T = copyT;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		Ls -= 2 * size;
		Hs -= 2 * size;
		Na -= 2 * size;
		Ws -= size;
		T += size;

		FdPoint3d p1, p2;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls };
		double height[2] = { Hs, Hs };
		bool sides[4] = { true, true, true, true };

		p1 = cp;
		p2 = cp + v * Ws;
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, false, 0, 5, size);

		FdPoint3d tp;
		for( int i = 0; i < N; i++ )
		{
			p1 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * i + (Ls / N) / 2 );
			tp = cp + v * Ws + cv * ( -(Ls + 2 * size) / 2 + ((Ls + 2 * size) / N) * i + ((Ls + 2 * size) / N) / 2 );
			double heightWidth[2] = { Hs, Ls / N };
			double tubeParameters[3] = { Na, Na, T };
			makeRectToTubeTransition(p1, v, upv, heightWidth, tp, tubeParameters, cpx);

			tp += v * T;
			makeFlatRing(tp, v, Na, Na + 2 * size, cpx);
		}

		if( N > 1 )
			for( int i = 0; i < N - 1; i++ )
			{
				p1 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) + upv * Hs / 2;
				p2 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) - upv * Hs / 2;
				addEraseLine(p1, p2);
			}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}
}

void GLEDiffusersAndGrills::makeBBL(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Hs, double Na, double Ws, double T, double Td, int N)
{
	FdPoint3d p1, p2;
	FdPoint3d p[2];
	FdVector3d v = normal;
	FdVector3d upv = upVector;
	FdVector3d cv = v.crossProduct(upv);
	FdVector3d vector[2] = { v, v };
	FdVector3d upvector[2] = { upv, upv };
	double width[2] = { Ls, Ls };
	double height[2] = { Hs, Hs };
	bool sides[4] = { false, true, true, true };

	p1 = cp;
	p2 = cp + v * Ws;
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, vector, upvector, width, height, sides, false, true, 5, 5, 30);

	FdPoint3d tp;
	if( N > 0 )
		for( int i = 0; i < N; i++ )
		{
			p1 = cp + v * Ws / 2    + upv * Hs / 2 + cv * ( -Ls / 2 + (Ls / N) * i + (Ls / N) / 2 );
			tp = cp + v * (Ws - Td) + upv * Hs / 2 + cv * ( -Ls / 2 + (Ls / N) * i + (Ls / N) / 2 );

			double heightWidth[2] = { Ws, Ls / N };
			double tubeParameters[3] = { Na, Na, T };
			makeRectToTubeTransition(p1, upv, v, heightWidth, tp, tubeParameters, cpx);
		}

	if( N > 1 )
		for( int i = 0; i < N - 1; i++ )
		{
			p1 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) + upv * Hs / 2;
			p2 = cp + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) + upv * Hs / 2;
			addEraseLine(p1, p2);
		}

	/****************************Copy/create Insulation vairables*******************/
	double size, copyLs = Ls, copyHs = Hs, copyNa = Na, copyWs = Ws, copyT = T, copyTd = Td;

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		Ls += 2 * size;
		Hs += 2 * size;
		Na += 2 * size;
		Ws += size;
		Td += size;
		T -= size;

		FdPoint3d p1, p2;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls };
		double height[2] = { Hs, Hs };
		bool sides[4] = { false, true, true, true };

		p1 = cp;
		p2 = cp + v * Ws;
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, true, (size > 20)?0:5, 5, 20 - size);

		FdPoint3d tp;
		if( N > 0 )
			for( int i = 0; i < N; i++ )
			{
				p1 = cp + v * Ws / 2    + upv * Hs / 2 + cv * ( -Ls / 2 + (Ls / N) * i + (Ls / N) / 2 );
				tp = cp + v * (Ws - Td) + upv * Hs / 2 + cv * ( -(Ls - 2 * size) / 2 + ((Ls - 2 * size) / N) * i + ((Ls - 2 * size) / N) / 2 );
				double heightWidth[2] = { Ws, Ls / N };
				double tubeParameters[3] = { Na, Na, T };
				makeRectToTubeTransition(p1, upv, v, heightWidth, tp, tubeParameters, cpx);

				tp += upv * T;
				makeFlatRing(tp, upv, Na, Na - 2 * size, cpx);
			}

		if( N > 1 )
			for( int i = 0; i < N - 1; i++ )
			{
				p1 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) + upv * Hs / 2;
				p2 = cp + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) + upv * Hs / 2;
				addEraseLine(p1, p2);
			}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}

	/**********************************Recover variables*******************************/
	Ls = copyLs;  Hs = copyHs;  Na = copyNa;  Ws = copyWs;  T = copyT;  Td = copyTd;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		Ls -= 2 * size;
		Hs -= 2 * size;
		Na -= 2 * size;
		Ws -= size;
		Td -= size;
		T += size;

		FdPoint3d p1, p2;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls };
		double height[2] = { Hs, Hs };
		bool sides[4] = { false, true, true, true };

		p1 = cp;
		p2 = cp + v * Ws;
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, true, 0, 5, size);

		FdPoint3d tp;
		if( N > 0 )
			for( int i = 0; i < N; i++ )
			{
				p1 = cp + v * Ws / 2    + upv * Hs / 2 + cv * ( -Ls / 2 + (Ls / N) * i + (Ls / N) / 2 );
				tp = cp + v * (Ws - Td) + upv * Hs / 2 + cv * ( -(Ls + 2 * size) / 2 + ((Ls + 2 * size) / N) * i + ((Ls + 2 * size) / N) / 2 );
				double heightWidth[2] = { Ws, Ls / N };
				double tubeParameters[3] = { Na, Na, T };
				makeRectToTubeTransition(p1, upv, v, heightWidth, tp, tubeParameters, cpx);

				tp += upv * T;
				makeFlatRing(tp, upv, Na, Na + 2 * size, cpx);
			}

		if( N > 1 )
			for( int i = 0; i < N - 1; i++ )
			{
				p1 = cp + v * Ws + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) + upv * Hs / 2;
				p2 = cp + cv * ( -Ls / 2 + (Ls / N) * (i + 1) ) + upv * Hs / 2;
				addEraseLine(p1, p2);
			}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}
}

void GLEDiffusersAndGrills::makeBPNF(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Hs, double Na, double Ws, double T, double alfa, int N)
{
	alfa = (alfa * ARX_PI) / 180.0;
	double b = tan(alfa) * Ws;
	FdPoint3d p1, p2;
	FdPoint3d p[2];
	FdVector3d v = normal;
	FdVector3d upv = upVector;
	FdVector3d cv = v.crossProduct(upv);
	FdVector3d vector[2] = { v, v };
	FdVector3d upvector[2] = { upv, upv };
	double width[2] = { Ls, Ls - 2 * b };
	double height[2] = { Hs, Hs - 2 * b };
	bool sides[4] = { true, true, true, true };

	p1 = cp;
	p2 = cp + v * Ws;
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, vector, upvector, width, height, sides, false, false, 5, 5, 30);

	for( int i = 0; i < N; i++ )
	{
		p1 = cp + v * Ws + cv * ( -(Ls - 2 * b) / 2 + ((Ls - 2 * b) / N) * i + ((Ls - 2 * b) / N) / 2 );
		double heightWidth[2] = { Hs - 2 * b, (Ls - 2 * b) / N };
		double tubeParameters[3] = { Na, Na, T };
		makeRectToTubeTransition(p1, v, upv, heightWidth, p1, tubeParameters, cpx);
	}

	/****************************Copy/create Insulation vairables*******************/
	double size, copyLs = Ls, copyHs = Hs, copyNa = Na, copyWs = Ws, copyT = T;

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		Ls += 2 * size;
		Hs += 2 * size;
		Na += 2 * size;
		Ws += size;
		T -= size;

		double b = tan(alfa) * Ws;
		FdPoint3d p1, p2;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls - 2 * b };
		double height[2] = { Hs, Hs - 2 * b };
		bool sides[4] = { true, true, true, true };

		p1 = cp;
		p2 = cp + v * Ws;
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, false, (size > 20) ? 0 : 5, 5, 20 - size);

		for( int i = 0; i < N; i++ )
		{
			p1 = cp + v * Ws + cv * ( -(Ls - 2 * b) / 2 + ((Ls - 2 * b) / N) * i + ( (Ls - 2 * b) / N ) / 2 );
			p2 = cp + v * Ws + cv * ( -((Ls - 2 * size) - 2 * b) / 2 + (((Ls - 2 * size) - 2 * b) / N) * i + ( ((Ls - 2 * size) - 2 * b) / N ) / 2 );
			double heightWidth[2] = { (Hs - 2 * b), (Ls - 2 * b) / N };
			double tubeParameters[3] = { Na, Na, T };
			makeRectToTubeTransition(p1, v, upv, heightWidth, p2, tubeParameters, cpx);

			p2 += v * T;
			makeFlatRing(p2, v, Na, Na - 2 * size, cpx);
		}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}

	/**********************************Recover variables*******************************/
	Ls = copyLs;  Hs = copyHs;  Na = copyNa;  Ws = copyWs;  T = copyT;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		Ls -= 2 * size;
		Hs -= 2 * size;
		Na -= 2 * size;
		Ws -= size;
		T += size;

		double b = tan(alfa) * Ws;
		FdPoint3d p1, p2;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls - 2 * b };
		double height[2] = { Hs, Hs - 2 * b };
		bool sides[4] = { true, true, true, true };

		p1 = cp;
		p2 = cp + v * Ws;
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, false, 5, 5, 30);

		for( int i = 0; i < N; i++ )
		{
			p1 = cp + v * Ws + cv * ( -(Ls - 2 * b) / 2 + ((Ls - 2 * b) / N) * i + ( (Ls - 2 * b) / N ) / 2 );
			p2 = cp + v * Ws + cv * ( -((Ls + 2 * size) - 2 * b) / 2 + (((Ls + 2 * size) - 2 * b) / N) * i + ( ((Ls + 2 * size) - 2 * b) / N ) / 2 );
			double heightWidth[2] = { (Hs - 2 * b), (Ls - 2 * b) / N };
			double tubeParameters[3] = { Na, Na, T };
			makeRectToTubeTransition(p1, v, upv, heightWidth, p2, tubeParameters, cpx);

			p2 += v * T;
			makeFlatRing(p2, v, Na, Na + 2 * size, cpx);
		}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}
}

void GLEDiffusersAndGrills::makeBPNL(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Hs, double Na, double Ws, double T, double Td, double alfa, int N)
{
	alfa = (alfa * ARX_PI) / 180.0;
	double b = tan(alfa) * Ws;
	FdPoint3d p1, p2, p3, p4;
	FdPoint3d p[2];
	FdVector3d v = normal;
	FdVector3d upv = upVector;
	FdVector3d cv = v.crossProduct(upv);
	FdVector3d vector[2] = { v, v };
	FdVector3d upvector[2] = { upv, upv };
	double width[2] = { Ls, Ls - b };
	double height[2] = { Hs, Hs - 2 * b };
	bool sides[4] = { true, true, true, false };

	p1 = cp;
	p2 = cp + v * Ws + cv * (-Ls / 2 + (Ls - b) / 2);
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, vector, upvector, width, height, sides, false, true, 5, 5, 30);

	double tubeParameters[3] = { Na, Na, T };
	for( int i = 0; i < N; i++ )
	{
		p2 = cp - cv * (Ls / 2) + upv * ( -Hs / 2 + b + ((Hs - 2 * b) / N) * (i + 1) ) + v * Ws;
		p3 = cp - cv * (Ls / 2) + upv * ( -Hs / 2 + b + ((Hs - 2 * b) / N) * i )       + v * Ws;
		p4 = cp - cv * (Ls / 2) + upv * ( -Hs / 2 + (Hs / N) * i );
		p1 = cp - cv * (Ls / 2) + upv * ( -Hs / 2 + (Hs / N) * (i + 1) );

		if( i != 0 )  addEraseLine(p4, p3);

		FdPoint3d corners[4] = { p1, p2, p3, p4 };

		p1 = cp + v * (Ws - Td) - cv * (Ls / 2) + upv * ( -Hs / 2 + (Hs / N) * i + (Hs / N) / 2 );
		makeRectToTubeTransition(p1, -cv, -v, corners, p1, tubeParameters, cpx);
	}

	/****************************Copy/create Insulation vairables*******************/
	double size, copyLs = Ls, copyHs = Hs, copyNa = Na, copyWs = Ws, copyT = T, copyTd = Td;

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		Ls += 2 * size;
		Hs += 2 * size;
		Na += 2 * size;
		Ws += size;
		Td += size;
		T -= size;

		double b = tan(alfa) * Ws;
		FdPoint3d p1, p2, p3, p4;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls - b };
		double height[2] = { Hs, Hs - 2 * b };
		bool sides[4] = { true, true, true, false };

		p1 = cp;
		p2 = cp + v * Ws + cv * (-Ls / 2 + (Ls - b) / 2);
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, true, (size > 20) ? 0 : 5, 5, 20 - size);

		double tubeParameters[3] = { Na, Na, T };
		for( int i = 0; i < N; i++ )
		{
			p2 = cp - cv * (Ls / 2) + upv * ( -(Hs - 2 * b) / 2 + ((Hs - 2 * b) / N) * (i + 1) ) + v * Ws;
			p3 = cp - cv * (Ls / 2) + upv * ( -(Hs - 2 * b) / 2 + ((Hs - 2 * b) / N) * i )     + v * Ws;
			p4 = cp - cv * (Ls / 2) + upv * ( -Hs / 2 + (Hs / N) * i );
			p1 = cp - cv * (Ls / 2) + upv * ( -Hs / 2 + (Hs / N) * (i + 1) );

			if( i != 0 )  addEraseLine(p4, p3);

			FdPoint3d corners[4] = { p1, p2, p3, p4 };

			p1 = cp + v * (Ws - Td) - cv * (Ls / 2) + upv * ( -Hs / 2 + size + ((Hs - 2 * size) / N) * i + ((Hs - 2 * size) / N) / 2 );
			makeRectToTubeTransition(p1, -cv, -v, corners, p1, tubeParameters, cpx);

			p1 -= cv * T;
			makeFlatRing(p1, cv, Na, Na - 2 * size, cpx);
		}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}

	/**********************************Recover variables*******************************/
	Ls = copyLs;  Hs = copyHs;  Na = copyNa;  Ws = copyWs;  T = copyT;  Td = copyTd;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		Ls -= 2 * size;
		Hs -= 2 * size;
		Na -= 2 * size;
		Ws -= size;
		Td -= size;
		T += size;

		double b = tan(alfa) * Ws;
		FdPoint3d p1, p2, p3, p4;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls - b };
		double height[2] = { Hs, Hs - 2 * b };
		bool sides[4] = { true, true, true, false };

		p1 = cp;
		p2 = cp + v * Ws + cv * (-Ls / 2 + (Ls - b) / 2);
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, true, 0, 5, size);

		double tubeParameters[3] = { Na, Na, T };

		for( int i = 0; i < N; i++ )
		{
			p2 = cp - cv * (Ls / 2) + upv * ( -Hs / 2 + b + ((Hs - 2 * b) / N) * (i + 1) ) + v * Ws;
			p3 = cp - cv * (Ls / 2) + upv * ( -Hs / 2 + b + ((Hs - 2 * b) / N) * i )       + v * Ws;
			p4 = cp - cv * (Ls / 2) + upv * ( -Hs / 2 + (Hs / N) * i );
			p1 = cp - cv * (Ls / 2) + upv * ( -Hs / 2 + (Hs / N) * (i + 1) );

			if(i != 0 )  addEraseLine(p4, p3);

			FdPoint3d corners[4] = { p1, p2, p3, p4 };

			p1 = cp + v * (Ws - Td) - cv * (Ls / 2) + upv * ( -Hs / 2 - size + ((Hs + 2 * size) / N) * i + ((Hs + 2 * size) / N) / 2 );
			makeRectToTubeTransition(p1, -cv, -v, corners, p1, tubeParameters, cpx);

			p1 -= cv * T;
			makeFlatRing(p1, cv, Na, Na + 2 * size, cpx);
		}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}
}

void GLEDiffusersAndGrills::makeDNK(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Ws, double Na, double Na1, double Hs, double T, double T1, double alfa, double Hsg, int N)
{
	alfa = (alfa * ARX_PI) / 180.0;
	double alfa1 = alfa / 2;
	double b = tan(alfa) * Hs;
	double c = tan(alfa1) * Hs;
	FdPoint3d p1, p2, p3, p4;
	FdPoint3d p[2];
	FdVector3d v = normal;
	FdVector3d upv = upVector;
	FdVector3d cv = v.crossProduct(upv);
	v.normalize();  upv.normalize();  cv.normalize();
	FdVector3d vector[2] = { v, v };
	FdVector3d upvector[2] = { upv, upv };
	double width[2] = { Ls, Ls - b };
	double height[2] = { Ws, Ws - 2 * c };
	bool sides[4] = { true, true, true, false };

	p1 = cp;
	p2 = cp + v * Hs + cv * (-Ls / 2 + (Ls - b) / 2);
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, vector, upvector, width, height, sides, false, true, 5, 5, 30);

	v = normal;
	cv = v.crossProduct(upv);
	p1 = cp;
	double heightWidth[2] = { Ws, Ls };
	double tubeParameters[3] = { Na1, Na1, T1 };
	makeRectToTubeTransition(p1, -v, upv, heightWidth, cp, tubeParameters, cpx);

	tubeParameters[0] = Na;  tubeParameters[1] = Na;  tubeParameters[2] = T;

	for( int i = 0; i < N; i++ )
	{
		p2 = cp - cv * (Ls / 2) + upv * ( -(Ws - 2 * c) / 2 + ((Ws - 2 * c) / N) * (i + 1) ) + v * Hs;
		p3 = cp - cv * (Ls / 2) + upv * ( -(Ws - 2 * c) / 2 + ((Ws - 2 * c) / N) * i )       + v * Hs;
		p4 = cp - cv * (Ls / 2) + upv * ( -Ws / 2 + (Ws / N) * i );
		p1 = cp - cv * (Ls / 2) + upv * ( -Ws / 2 + (Ws / N) * (i + 1) );

		if( i != 0 )  addEraseLine(p3, p4);

		FdPoint3d corners[4] = { p1, p2, p3, p4 };
		p1 = cp + v * (Hs - Hsg) - cv * (Ls / 2) + upv * ( -Ws / 2 + (Ws / N) * i + (Ws / N) / 2 );
		makeRectToTubeTransition(p1, -cv, -v, corners, p1, tubeParameters, cpx);
	}

	/****************************Copy/create Insulation vairables*******************/
	double size, copyLs = Ls, copyHs = Hs, copyNa = Na, copyWs = Ws, copyT = T, copyHsg = Hsg;

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		Ls += 2 * size;
		Hs += size;
		Na += 2 * size;
		Ws += 2 * size;
		Hsg += size;
		T -= size;

		double b = tan(alfa) * Hs;
		double c = tan(alfa1) * Hs;
		FdPoint3d p1, p2, p3, p4;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		v.normalize();  upv.normalize();  cv.normalize();
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls - b };
		double height[2] = { Ws, Ws - 2 * c };
		bool sides[4] = { true, true, true, false };

		p1 = cp;
		p2 = cp + v * Hs + cv * (-Ls / 2 + (Ls - b) / 2);
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, true, 0, 5, -size);

		v = normal;
		cv = v.crossProduct(upv);
		p1 = cp;
		double heightWidth[2] = { Ws, Ls };
		double tubeParameters[3] = { Na1, Na1, T1 };
		// makeRectToTubeTransition(p1, -v, upv, heightWidth, cp, tubeParameters, cpx);

		tubeParameters[0] = Na;  tubeParameters[1] = Na;  tubeParameters[2] = T;

		for( int i = 0; i < N; i++ )
		{
			p2 = cp - cv * (Ls / 2) + upv * ( -(Ws - 2 * c) / 2 + ((Ws - 2 * c) / N) * (i + 1) ) + v * Hs;
			p3 = cp - cv * (Ls / 2) + upv * ( -(Ws - 2 * c) / 2 + ((Ws - 2 * c) / N) * i )       + v * Hs;
			p4 = cp - cv * (Ls / 2) + upv * ( -Ws / 2 + (Ws / N) * i );
			p1 = cp - cv * (Ls / 2) + upv * ( -Ws / 2 + (Ws / N) * (i + 1) );

			if( i != 0 )  addEraseLine(p3, p4);

			FdPoint3d corners[4] = { p1, p2, p3, p4 };

			p1 = cp + v * (Hs - Hsg) - cv * (Ls / 2) + upv * ( -(Ws - 2 * size) / 2 + ((Ws - 2 * size) / N) * i + ((Ws - 2 * size) / N) / 2 );
			makeRectToTubeTransition(p1, -cv, -v, corners, p1, tubeParameters, cpx);

			p1 -= cv * T;
			makeFlatRing(p1, cv, Na, Na - 2 * size, cpx);
		}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}

	/**********************************Recover variables*******************************/
	Ls = copyLs;  Hs = copyHs;  Na = copyNa;  Ws = copyWs;  T = copyT;  Hsg = copyHsg;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		Ls -= 2 * size;
		Hs -= size;
		Na -= 2 * size;
		Ws -= 2 * size;
		Hsg -= size;
		T += size;

		double b = tan(alfa) * Hs;
		double c = tan(alfa1) * Hs;
		FdPoint3d p1, p2, p3, p4;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		v.normalize();  upv.normalize();  cv.normalize();
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls - b };
		double height[2] = { Ws, Ws - 2 * c };
		bool sides[4] = { true, true, true, false };

		p1 = cp;
		p2 = cp + v * Hs + cv * (-Ls / 2 + (Ls - b) / 2);
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, true, 5, 5, 30);

		v = normal;
		cv = v.crossProduct(upv);
		p1 = cp;
		double heightWidth[2] = { Ws, Ls };
		double tubeParameters[3] = { Na1, Na1, T1 };
		// makeRectToTubeTransition(p1, -v, upv, heightWidth, cp, tubeParameters, cpx);

		tubeParameters[0] = Na;  tubeParameters[1] = Na;  tubeParameters[2] = T;

		for( int i = 0; i < N; i++ )
		{
			p2 = cp - cv * (Ls / 2) + upv * ( -(Ws - 2 * c) / 2 + ((Ws - 2 * c) / N) * (i+1) ) + v * Hs;
			p3 = cp - cv * (Ls / 2) + upv * ( -(Ws - 2 * c) / 2 + ((Ws - 2 * c) / N) * i )     + v * Hs;
			p4 = cp - cv * (Ls / 2) + upv * ( -Ws / 2 + (Ws / N) * i );
			p1 = cp - cv * (Ls / 2) + upv * ( -Ws / 2 + (Ws / N) * (i + 1) );

			if( i != 0 )  addEraseLine(p3, p4);

			FdPoint3d corners[4] = { p1, p2, p3, p4 };

			p1 = cp + v * (Hs - Hsg) - cv * (Ls / 2) + upv * ( -(Ws + 2 * size) / 2 + ((Ws + 2 * size) / N) * i + ((Ws + 2 * size) / N) / 2 );
			makeRectToTubeTransition(p1, -cv, -v, corners, p1, tubeParameters, cpx);

			p1 -= cv * T;
			makeFlatRing(p1, cv, Na, Na + 2 * size, cpx);
		}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}
}



void GLEDiffusersAndGrills::makeDMK(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Hs, double Na, double Na1, double Ws, double T, double T1, double alfa, int N)
{
	alfa = (alfa * ARX_PI) / 180.0;
	double b = tan(alfa) * Ws;
	FdPoint3d p1, p2;
	FdPoint3d p[2];
	FdVector3d v = normal;
	FdVector3d upv = upVector;
	FdVector3d cv = v.crossProduct(upv);
	FdVector3d vector[2] = { v, v };
	FdVector3d upvector[2] = { upv, upv };
	double width[2] = { Ls, Ls - 2 * b };
	double height[2] = { Hs, Hs - 2 * b };
	bool sides[4] = { true, true, true, true };

	p1 = cp;
	p2 = cp + v * Ws;
	p[0] = p1;  p[1] = p2;
	makeBox(1, p, vector, upvector, width, height, sides, false, false, 5, 5, 30);

	v = normal;
	cv = v.crossProduct(upv);
	p1 = cp;
	double heightWidth1[2] = { Hs, Ls };
	double tubeParameters1[3] = { Na1, Na1, T1 };
	makeRectToTubeTransition(p1, -v, upv, heightWidth1, cp, tubeParameters1, cpx);

	for( int i = 0; i < N; i++ )
	{
		p1 = cp + v * Ws + cv * ( -(Ls - 2 * b) / 2 + ((Ls - 2 * b) / N) * i + ((Ls - 2 * b) / N) / 2 );
		double heightWidth[2] = { (Hs - 2 * b), (Ls - 2 * b) / N };
		double tubeParameters[3] = { Na, Na, T };
		makeRectToTubeTransition(p1, v, upv, heightWidth, p1, tubeParameters, cpx);
	}

	/****************************Copy/create Insulation vairables*******************/
	double size, copyLs = Ls, copyHs = Hs, copyNa = Na, copyWs = Ws, copyT = T;

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		Ls += 2 * size;
		Hs += 2 * size;
		Na += 2 * size;
		Ws += size;
		T -= size;

		double b = tan(alfa) * Ws;
		FdPoint3d p1, p2;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls - 2 * b };
		double height[2] = { Hs, Hs - 2 * b };
		bool sides[4] = { true, true, true, true };

		p1 = cp;
		p2 = cp + v * Ws;
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, false, 0, 5, -size);

		v = normal;
		cv = v.crossProduct(upv);
		p1 = cp;
		double heightWidth1[2] = { Hs, Ls };
		double tubeParameters1[3] = { Na1, Na1, T1 };
		// makeRectToTubeTransition(p1, -v, upv, heightWidth1, cp, tubeParameters1, cpx);

		for( int i = 0; i < N; i++ )
		{
			p1 = cp + v * Ws + cv * ( -Ls / 2 + b + ((Ls - 2 * b) / N) * i + ( (Ls - 2 * b) / N ) / 2 );
			p2 = cp + v * Ws + cv * ( -Ls / 2 + size + b + ((Ls - 2 * size - 2 * b) / N) * i + ( ((Ls - 2 * size) - 2 * b) / N ) / 2 );
			double heightWidth[2] = { (Hs - 2 * b), (Ls - 2 * b) / N };
			double tubeParameters[3] = { Na, Na, T };
			makeRectToTubeTransition(p1, v, upv, heightWidth, p2, tubeParameters, cpx);

			p2 += v * T;
			makeFlatRing(p2, v, Na, Na - 2 * size, cpx);
		}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}
	/**********************************Recover variables*******************************/
	Ls = copyLs;  Hs = copyHs;  Na = copyNa;  Ws = copyWs;  T = copyT;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		Ls -= 2 * size;
		Hs -= 2 * size;
		Na -= 2 * size;
		Ws -= size;
		T += size;

		double b = tan(alfa) * Ws;
		FdPoint3d p1, p2;
		FdPoint3d p[2];
		FdVector3d v = normal;
		FdVector3d upv = upVector;
		FdVector3d cv = v.crossProduct(upv);
		FdVector3d vector[2] = { v, v };
		FdVector3d upvector[2] = { upv, upv };
		double width[2] = { Ls, Ls - 2 * b };
		double height[2] = { Hs, Hs - 2 * b };
		bool sides[4] = { true, true, true, true };

		p1 = cp;
		p2 = cp + v * Ws;
		p[0] = p1;  p[1] = p2;
		makeBox(1, p, vector, upvector, width, height, sides, false, false, 5, 5, 30);

		v = normal;
		cv = v.crossProduct(upv);
		p1 = cp;
		double heightWidth1[2] = { Hs, Ls };
		double tubeParameters1[3] = { Na1, Na1, T1 };
		// makeRectToTubeTransition(p1, -v, upv, heightWidth1, cp, tubeParameters1, cpx);

		for( int i = 0; i < N; i++ )
		{
			p1 = cp + v * Ws + cv * ( -Ls / 2 + b + ((Ls - 2 * b) / N) * i + ( (Ls - 2 * b) / N ) / 2 );
			p2 = cp + v * Ws + cv * ( -Ls / 2 - size + b + (((Ls + 2 * size) - 2 * b) / N) * i + ( ((Ls + 2 * size) - 2 * b) / N ) / 2 );
			double heightWidth[2] = { (Hs - 2 * b), (Ls - 2 * b) / N };
			double tubeParameters[3] = { Na, Na, T };
			makeRectToTubeTransition(p1, v, upv, heightWidth, p2, tubeParameters, cpx);

			p2 += v * T;
			makeFlatRing(p2, v, Na, Na + 2 * size, cpx);
		}

		setPrimitiveMode(FLM3Geo::pmNormal);
	}
}





// New diffusers and grills - by PK - 09.05.29

// CDD -> command from library GenGrCDD
void GLEDiffusersAndGrills::makeCDD(double d0, double d1, double h0, double h1, double h2, double h3, double h4, double h5, double l1, int n)
{
	// declaration of additional variables

	// declaration of start / center points
	FdPoint3d p0(0, 0, 0);          // start point of top tube
	FdPoint3d p1(0, 0, -h1);        // start point of top cover
	FdPoint3d p2(0, 0, -(h1+h2));   // start point of main tube
	FdPoint3d p3(0, 0, -h1-h0+h3);  // start point of bottom cover
	FdPoint3d p4(0, 0, -h1-h0);     // end point of element

	FdPoint3d s0;  // start point for drawing symbolic arc

	// top tube + top cover
	double topCoverDiam[4] = {d0, d0, d1, d1};
	FdPoint3d topCoverCPoint[4] = {p0, p1, p1, p2};

	makeStraightTube(topCoverCPoint, topCoverDiam, n, 3, true);

	// main tube
	double mainTubeDiam[2] = {d1, d1};
	FdPoint3d mainTubeCPoint[2] = {p2, p3};

	makeStraightTube(mainTubeCPoint, mainTubeDiam, n, 1, true);

	// grill lines on main tube
	FdVector3d radVect(1, 0, 0);

	double lineQuant = 360/l1;  // quantity of drawn lines
	int countHeight = 0;

	while ((h4+(double)countHeight*h5)<(h0-(h3+h2)))
	// while ((h1+h2+h4+(double)countHeight*h5)<(h0-(h3+h2)))
	{
		for (int countAng = 0; countAng<lineQuant; countAng=countAng+2)
		{
			double dx, dy;
			double alfa = (double)l1*M_PI/180;

			if (countHeight%2)  // odd and even arc (due to z) are shifted of alfa angle
			{
				dx = 0.5*d1*cos(countAng*alfa+0.5*alfa); dy = 0.5*d1*sin(countAng*alfa+0.5*alfa);
			}
			else
			{
				dx = 0.5*d1*cos(countAng*alfa+1.5*alfa); dy = 0.5*d1*sin(countAng*alfa+1.5*alfa);
			}

			s0.set(0, 0, -(h1+h2+h4+(double)countHeight*h5));
			radVect.set(2*dx/d1, 2*dy/d1, 0);  // defining radiant vector attached to the arc start point

			makeSymbolicArc(s0, vz, radVect, d1/2, l1);
		}
		countHeight++;
	}

	// bottom cover
	double botCoverDiam[3] = {d1, d1, 0.001};
	FdPoint3d botCoverCPoint[3] = {p3, p4, p4};

	makeStraightTube(botCoverCPoint, botCoverDiam, n, 2, true);

	// conector
	addCircularConnector(p0);
}

// RDD -> command from library GenGrRDD
void GLEDiffusersAndGrills::makeRDD(double d0, double a0, double b0, double h0, double h1, double h2, double h3, double h4, double h5, double l1, double l2, int n)
{
	// declaration of additional variables
	// h1 = h0/6.1;
	double boxWidth[2] = {b0, b0};
	double boxHeight[2]  = {a0, a0};

	// declaration of start / center points
	FdPoint3d p0(0, 0, 0);          // start point of top tube
	FdPoint3d p1(0, 0, -h1);        // start point of top box
	FdPoint3d p2(0, 0, -(h1+h2));   // start point of main box
	FdPoint3d p3(0, 0, -h1-h0+h3);  // start point of bottom box
	FdPoint3d p4(0, 0, -h1-h0);     // end point of element

	// side and connector definition
	bool sidesC[4] = {true, true, true, true};
	bool conC[2] = {false, false};

	// top tube
	double topTubeDiam[2] = {d0, d0};
	FdPoint3d topTubeCPoint[3] = {p0, p1};

	makeStraightTube(topTubeCPoint, topTubeDiam, n, 1, true);

	// top cover
	double topCoverDim[2] = {b0, a0};
	double topTubeParams[3] = {d0, d0, 0};

	makeRectToTubeTransition(p1, vz, vy, topCoverDim, p1, topTubeParams, n);

	// top box
	FdPoint3d boxCPoints[2] = {p1, p2};

	makeBox(1, boxCPoints, boxWidth, boxHeight, sidesC, conC, false, false);

	// main box
	boxCPoints[0] = p2; boxCPoints[1] = p3;
	makeBox(1, boxCPoints, boxWidth, boxHeight, sidesC, conC, false, false);

	// bottom box + bottom cover
	boxCPoints[0] = p3; boxCPoints[1] = p4;
	makeBox(1, boxCPoints, boxWidth, boxHeight, sidesC, conC, false, true);

	// conector
	addCircularConnector(p0);

	// grill symbolic lines
	int lineCount = 0;
	int vertCount = 0;

	l1 = a0/11;
	l2 = b0/11;

	FdPoint3d s0(0, 0, 0), s1(0, 0, 0);
	FdPoint3d s2(0, 0, 0), s3(0, 0, 0);

	// on side A
	while (h4+vertCount*h5<(h0-(h2+h3)))
	{
		for (lineCount = 0; lineCount*l1 <= a0; lineCount = lineCount + 2)  // condition is terrible - have to find better one
		{
			if (vertCount%2)
			{
				s0.set(-0.5*a0+lineCount*l1, -0.5*b0, -(h1+h2+h4)-vertCount*h5); s1.set(-0.5*a0+lineCount*l1+l1, -0.5*b0, -(h1+h2+h4)-vertCount*h5);
				s2.set(-0.5*a0+lineCount*l1, 0.5*b0, -(h1+h2+h4)-vertCount*h5); s3.set(-0.5*a0+lineCount*l1+l1, 0.5*b0, -(h1+h2+h4)-vertCount*h5);
			}
			else
			{
				s0.set(-0.5*a0+lineCount*l1+l1, -0.5*b0, -(h1+h2+h4)-vertCount*h5); s1.set(-0.5*a0+lineCount*l1+2*l1, -0.5*b0, -(h1+h2+h4)-vertCount*h5);
				s2.set(-0.5*a0+lineCount*l1+l1, 0.5*b0, -(h1+h2+h4)-vertCount*h5); s3.set(-0.5*a0+lineCount*l1+2*l1, 0.5*b0, -(h1+h2+h4)-vertCount*h5);
			}
			if (s1[0] > 0.5*a0+0.1) break;
			else
			{
				makeSymbolicLine(s0, s1); makeSymbolicLine(s2, s3);
			}
		}
		vertCount ++;
	}

	// on side B
	vertCount = 0;
	while (h4+vertCount*h5<(h0-(h2+h3)))
	{
		for (lineCount = 0; lineCount*l2 <= b0; lineCount = lineCount + 2)  // condition is terrible - have to find better one
		{
			if (vertCount%2)
			{
				s0.set(-0.5*a0, -0.5*b0+lineCount*l2, -(h1+h2+h4)-vertCount*h5); s1.set(-0.5*a0, -0.5*b0+lineCount*l2+l2, -(h1+h2+h4)-vertCount*h5);
				s2.set(0.5*a0, -0.5*b0+lineCount*l2, -(h1+h2+h4)-vertCount*h5); s3.set(0.5*a0, -0.5*b0+lineCount*l2+l2, -(h1+h2+h4)-vertCount*h5);
			}
			else
			{
				s0.set(-0.5*a0, -0.5*b0+lineCount*l2+l2, -(h1+h2+h4)-vertCount*h5); s1.set(-0.5*a0, -0.5*b0+lineCount*l2+2*l2, -(h1+h2+h4)-vertCount*h5);
				s2.set(0.5*a0, -0.5*b0+lineCount*l2+l2, -(h1+h2+h4)-vertCount*h5); s3.set(0.5*a0, -0.5*b0+lineCount*l2+2*l2, -(h1+h2+h4)-vertCount*h5);
			}
			if (s1[1] > 0.5*b0+0.1) break;
			else
			{
				makeSymbolicLine(s0, s1); makeSymbolicLine(s2, s3);
			}
		}
		vertCount ++;
	}
}





void GLEDiffusersAndGrills::makeGrNKSWA(double d, double a, double b, double l, int n)
{
	n = 10;

	FdPoint3d p1(0, 0, 0), p2(l, 0, 0);
	FdPoint3d cp[2] = { p1, p2 };
	double tabWidth[2] = { a, a };
	double tabHeight[2] = { b, b };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };

	makeBox(1, cp, tabWidth, tabHeight, sides, con, false, false);

	p1.set(0, 0, 0);
	double ab[2] = { a, b };
	double tubeParams[3] = { d, d, 0 };

	makeRectToTubeTransition(p1, vx, vy, ab, p1, tubeParams, n);
	double d2 = a;
	double d1 = d2;

	makeGrillType4(p2, vx, vy, 2, d2, d1, 45, 1, n, 10, true, a, b);
}

void GLEDiffusersAndGrills::makeGrKHA(double d1, double d2, double d3, double f, double l, double e, int n)
{
	// FdPoint3d p1(-l / 2, 0, 0), p2(l / 2, 0, 0);
	// FdPoint3d cp[2] = { p1, p2 };

	// double cut1 = sqrt(l / 2 * 2 - d2 / 2 * 2);
	// double cut_1 = l2 / 2 + cut1;
	// double final_cut1 = cut_1 - cut1;
	// double cut = l / 2;
	// double cut2 = sqrt(l * 2 - d1 * 2) * 2;

	// double latAngles[2] = { cut2, 180 };
	// double longAngles[2] = { 0, 360 };
	// double axisL[3] = { l, l, l };
	// int complex[2] = { 10, 20 };

	// makeSpheroidSection(p1, vx, latAngles, longAngles, axisL, complex);


	n = 10;
	FdPoint3d p1(         f / 2, 0, 0),
	          p2(       - f / 2, 0, 0),
	          p3(       - f / 2, 0, 0),
	          p4(   - e - f / 2, 0, 0),
	          p5(   - e - f / 2, 0, 0),
	          p6(-l - e - f / 2, 0, 0);
 
	// first tube
	FdPoint3d Cp1[2] = { p1, p2 };
	double dim1[2] = { d2, d3 };
	makeStraightTube(Cp1, dim1, n, 1, true);

	// second tube
	FdPoint3d Cp2[2] = { p3, p4 };
	double dim2[2] = { d3, d3 };
	makeStraightTube(Cp2, dim2, n, 1, true);

	// third tube
	FdPoint3d Cp3[2] = { p5, p6 };
	double dim3[2] = { d3, d1 };
	makeStraightTube(Cp3, dim3, n, 1, true);
}

void GLEDiffusersAndGrills::makeGrKPP(double d1, double d2, double L, double h, double ds, double hs, int n)
{
	int nt = 50;
	FdPoint3d p1(0, 0, 0), p2(L, 0, 0), p3(-h, 0, 0);
	FdPoint3d Fp[4] = { p2, p1, p1, p3 };
	double dim[4] = { d1, d1, d2, d2 };
	makeUniVectorTube(Fp, -vx, dim, nt, 3, false);

	FdPoint3d p4(-h, 0, 0);
	double latAngle[2] = { 90, 180 };
	double longAngle[2] = { 0, 360 };
	double axisLengths[3] = { hs, ds, ds };
	int nS[2] = { 100, 50 };
	makeSpheroidSection(p4, -vx, vy, latAngle, longAngle, axisLengths, nS);

	int Fn = 50;
	double innerDiameter = d1;
	double outerDiameter = d2;
	makeFlatRing(p3, vx, innerDiameter, outerDiameter, Fn);

	double DN = ds + 5;
	FdPoint3d Cp[2] = { p3, p1 };
	makeSimpleTube(Cp, ds, DN, Fn);
}

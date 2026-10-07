#include "StdAfx.h"
#include "CGeneral.h"

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

const int cpx = 10;
const int concpx = 5;
#define SEGNUM(X) 16
#define RCFlange 45
#define FIX_BRX  // Break apart any closed boxes into two open
                 // pieces, resolving HLR problems in BricsCAD.



FLM3Geo::ErrorStatus MakeFCBlock3d(FLM3Geo::BlockCreator3d *blockCreator, const char *blockName)
	{
	ASSERT( blockCreator );

	CGeneralBlockCreator oBlkCreator(*blockCreator);

	for( int Code = __COUNT_FN - 1; Code >= 0; --Code )
		if( !strcmp(blockName, __GEO_NAME[Code]) )
			return (oBlkCreator.*__GEO_FN[Code])() ? FLM3Geo::eInvalid : FLM3Geo::eOK;
	return FLM3Geo::eInvalid;
	};

short CGeneralBlockCreator :: makeCHIL()
	{
	ads_real a, b;
	ads_real h;
	ads_real d, l1;
	short ftype;
	short elType;

	get_val("A", a);
	get_val("B", b);
	get_val("H", h);
	get_val("d", d);
	get_val("l1", l1);

	get_val("ftype", ftype);
	get_val("elType", elType);

	// make box - the same for all objects?
	FdPoint3d p1(-a / 2, 0, 0),
	          p2( a / 2, 0, 0);
	FdPoint3d p[2] = { p1, p2 };
	double tabWidth[2] = { h, h };
	double tabHeight[2] = { b, b };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };
#ifndef FIX_BRX
	makeBox(1, p, tabWidth, tabHeight, sides, con, true, true);
#else
	bool _sides[4] = { false, false, false, false };
	makeBox(1, p, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, p, tabWidth, tabHeight, _sides, con, false, true);
#endif

	if( elType == 4 )
		{
		// 6 tubes, left top to right bottom
		p1.set(-a / 3, b / 2, 0);  p2.set(-a / 3, b / 2 + l1, 0);
		p[0] = p1;  p[1] = p2;
		makeSimpleTube(p, h - 15, h - 15, cpx);

		p1.set(0, b / 2, 0);  p2.set(0, b / 2 + l1, 0);
		p[0] = p1;  p[1] = p2;
		makeSimpleTube(p, h - 15, h - 15, cpx);

		p1.set(a / 3, b / 2, 0);  p2.set(a / 3, b / 2 + l1, 0);
		p[0] = p1;  p[1] = p2;
		makeSimpleTube(p, h - 15, h - 15, cpx);

		p1.set(-a / 3, -b / 2, 0);  p2.set(-a / 3, -b / 2 - l1, 0);
		p[0] = p1;  p[1] = p2;
		makeSimpleTube(p, h - 15, h - 15, cpx);

		p1.set(0, -b / 2, 0);  p2.set(0, -b / 2 - l1, 0);
		p[0] = p1;  p[1] = p2;
		makeSimpleTube(p, h - 15, h - 15, cpx);

		p1.set(a / 3, -b / 2, 0);  p2.set(a / 3, -b / 2 - l1, 0);
		p[0] = p1;  p[1] = p2;
		makeSimpleTube(p, h - 15, h - 15, cpx);
		};

	// front, back
	FdPoint3d ppc(0, 0, h / 2), pp1(-a / 4, 0, h / 2), pp2(a / 4, 0, h / 2);

	switch( elType )
		{
		case 0:
		case 1:
			makeHSym(ppc, vz, vy, min(a, b) / 6, ftype);
			ppc.z = -h / 2;
			makeHSym(ppc, vz, vy, min(a, b) / 6, ftype);
			break;
		case 2:
			makeVent(pp1, vz, -vy, min(a, b) * 0.45);  makeHSym(pp2, vz, vy, min(a, b) * 0.45, ftype);
			pp1.z = -h / 2;  pp2.z = -h / 2;
			makeVent(pp1, vz, -vy, min(a, b) * 0.45);  makeHSym(pp2, vz, vy, min(a, b) * 0.45, ftype);
			break;
		case 3:
			pp1.set(0, -b / 4, h / 2);  pp2.set(0, b / 4, h / 2);
			makeVent(pp1, vz, vy, min(a, b) / 6);  makeHSym(pp2, vz, vy, min(a, b) / 6, ftype);
			pp1.z = -h / 2;  pp2.z = -h / 2;
			makeVent(pp1, vz, vy, min(a, b) / 6);  makeHSym(pp2, vz, vy, min(a, b) / 6, ftype);
			break;
		case 4:
			pp1.set(0, -b / 4, h / 2);  pp2.set(0, b / 4, h / 2);
			makeVent(pp1, vz, vy, min(a, b) / 6);  makeHSym(pp2, vz, vy, min(a, b) / 6, ftype);
			pp1.z = -h / 2;  pp2.z = -h / 2;
			makeVent(pp1, vz, vy, min(a, b) / 6);  makeHSym(pp2, vz, vy, min(a, b) / 6, ftype);
			break;
		};

	if( b > h )
		{
		// top, bottom
		switch( elType )
			{
			case 0:
				pp1.set(0, b / 2, h / 4);  pp2.set(0, b / 2, -h / 4.5);
				makeHSym(pp1, vy, vz, min(a, h) / 6, ftype);  makeCGrill(pp2, vy, vz, a * 0.9, h * 0.45);
				pp1.y = -b / 2;  pp2.y = -b / 2;
				makeHSym(pp1, vy, vz, min(a, h) / 6, ftype);  makeCGrill(pp2, vy, vz, a * 0.9, h * 0.45);
				break;
			case 1:
				pp1.set(0, b / 2, 0);
				makeHSym(pp1, vy, vz, min(a, h) / 6, ftype);
				pp1.y = -b / 2;
				makeHSym(pp1, vy, vz, min(a, h) / 6, ftype);
				break;
			case 2:
				pp1.set(0, b / 2, -h / 4);  pp2.set(0, b / 2, h / 4);
				makeVent(pp1, vy, vz, min(a, h) / 6);  makeHSym(pp2, vy, vz, min(a, h) / 6, ftype);
				pp1.y = -b / 2;  pp2.y = -b / 2;
				makeVent(pp1, vy, vz, min(a, h) / 6);  makeHSym(pp2, vy, vz, min(a, h) / 6, ftype);
				break;
			case 3:
				pp1.set(-a / 4, b / 2, 0);  pp2.set(a / 4, b / 2, 0);
				makeVent(pp1, vy, vz, min(a, h) * 0.45);  makeHSym(pp2, vy, vz, min(a, h) * 0.45, ftype);
				pp1.y = -b / 2;  pp2.y = -b / 2;
				makeVent(pp1, vy, vz, min(a, h) * 0.45);  makeHSym(pp2, vy, vz, min(a, h) * 0.45, ftype);
				break;
			case 4:
				// pure HLR :D
				break;
			};

		// left, right
		switch( elType )
			{
			case 0:
				pp1.set(-a / 2, 0, h / 4);  pp2.set(-a / 2, 0, -h / 4.5);
				makeHSym(pp1, vx, vz, min(b, h) / 6, ftype);  makeCGrill(pp2, vx, vz, b * 0.9, h * 0.45);
				pp1.x = a / 2;  pp2.x = a / 2;
				makeHSym(pp1, vx, vz, min(b, h) / 6, ftype);  makeCGrill(pp2, vx, vz, b * 0.9, h * 0.45);
				break;
			case 1:
				pp1.set(-a / 2, 0, 0);  makeHSym(pp1, vx, vz, min(b, h) / 6, ftype);
				pp1.set( a / 2, 0, 0);  makeHSym(pp1, vx, vz, min(b, h) / 6, ftype);
				break;
			case 2:
				pp1.set(-a / 2, 0, h / 4);  pp2.set(-a / 2, 0, -h / 4);
				makeVent(pp1, vx, -vz, min(b, h) * 0.45);  makeHSym(pp2, vx, vz, min(b, h) * 0.45, ftype);
				pp1.x = a / 2;  pp2.x = a / 2;
				makeVent(pp1, vx, -vz, min(b, h) * 0.45);  makeHSym(pp2, vx, vz, min(b, h) * 0.45, ftype);
				break;
			case 3:
				pp1.set(-a / 2, -b / 4, 0);  pp2.set(-a / 2, b / 4, 0);
				makeVent(pp1, vx, -vy, min(b, h) * 0.45);  makeHSym(pp2, vx, vz, min(b, h) * 0.45, ftype);
				pp1.x = a / 2;  pp2.x = a / 2;
				makeVent(pp1, vx, -vy, min(b, h) * 0.45);  makeHSym(pp2, vx, vz, min(b, h) * 0.45, ftype);
				break;
			case 4:
				pp1.set(-a / 2, -b / 4, 0);  pp2.set(-a / 2, b / 4, 0);
				makeVent(pp1, vx, -vy, min(b, h) * 0.45);  makeHSym(pp2, vx, vz, min(b, h) * 0.45, ftype);
				pp1.x = a / 2;  pp2.x = a / 2;
				makeVent(pp1, vx, -vy, min(b, h) * 0.45);  makeHSym(pp2, vx, vz, min(b, h) * 0.45, ftype);
				break;
			};
		}
	else
		{
		// top, bottom
		switch( elType )
			{
			case 0:
				pp1.set(0, b / 2, h / 4);  pp2.set(0, b / 2, -h / 4.5);
				makeHSym(pp1, vy, vz, min(a, h) / 6, ftype);  makeCGrill(pp2, vy, vz, a * 0.9, h * 0.45);
				pp1.y = -b / 2;  pp2.y = -b / 2;
				makeHSym(pp1, vy, vz, min(a, h) / 6, ftype);  makeCGrill(pp2, vy, vz, a * 0.9, h * 0.45);
				break;
			case 1:
				pp1.set(0, b / 2, 0);
				makeHSym(pp1, vy, vz, min(a, h) / 6, ftype);
				pp1.y = -b / 2;
				makeHSym(pp1, vy, vz, min(a, h) / 6, ftype);
				break;
			case 2:
				pp1.set(0, b / 2, -h / 4);  pp2.set(0, b / 2, h / 4);
				makeVent(pp1, vy, vz, min(a, h) / 6);  makeHSym(pp2, vy, vz, min(a, h) / 6, ftype);
				pp1.y = -b / 2;  pp2.y = -b / 2;
				makeVent(pp1, vy, vz, min(a, h) / 6);  makeHSym(pp2, vy, vz, min(a, h) / 6, ftype);
				break;
			case 3:
				pp1.set(-a / 4, b / 2, 0);  pp2.set(a / 4, b / 2, 0);
				makeVent(pp1, vy, vz, min(a, h) / 6);  makeHSym(pp2, vy, vz, min(a, h) / 6, ftype);
				pp1.y = -b / 2;  pp2.y = -b / 2;
				makeVent(pp1, vy, vz, min(a, h) / 6);  makeHSym(pp2, vy, vz, min(a, h) / 6, ftype);
				break;
			case 4:
				// pure HLR :D
				break;
			};

		// left, right
		switch( elType )
			{
			case 0:
				pp1.set(-a / 2, 0, h / 4);  pp2.set(-a / 2, 0, -h / 4.5);
				makeHSym(pp1, vx, vz, min(b, h) / 6, ftype);  makeCGrill(pp2, vx, vz, b * 0.9, h * 0.45);
				pp1.x = a / 2;  pp2.x = a / 2;
				makeHSym(pp1, vx, vz, min(b, h) / 6, ftype);  makeCGrill(pp2, vx, vz, b * 0.9, h * 0.45);
				break;
			case 1:
				pp1.set(-a / 2, 0, 0);  makeHSym(pp1, vx, vz, min(b, h) / 6, ftype);
				pp1.set( a / 2, 0, 0);  makeHSym(pp1, vx, vz, min(b, h) / 6, ftype);
				break;
			case 2:
				pp1.set(-a / 2, 0, h / 4);  pp2.set(-a / 2, 0, -h / 4);
				makeVent(pp1, vx, -vz, min(b, h) / 6);  makeHSym(pp2, vx, vz, min(b, h) / 6, ftype);
				pp1.x = a / 2;  pp2.x = a / 2;
				makeVent(pp1, vx, -vz, min(b, h) / 6);  makeHSym(pp2, vx, vz, min(b, h) / 6, ftype);
				break;
			case 3:
				pp1.set(-a / 2, -b / 4, 0);  pp2.set(-a / 2, b / 4, 0);
				makeVent(pp1, vx, -vy, min(b, h) / 6);  makeHSym(pp2, vx, vz, min(b, h) / 6, ftype);
				pp1.x = a / 2;  pp2.x = a / 2;
				makeVent(pp1, vx, -vy, min(b, h) / 6);  makeHSym(pp2, vx, vz, min(b, h) / 6, ftype);
				break;
			case 4:
				pp1.set(-a / 2, -b / 4, 0);  pp2.set(-a / 2, b / 4, 0);
				makeVent(pp1, vx, -vy, min(b, h) / 6);  makeHSym(pp2, vx, vz, min(b, h) / 6, ftype);
				pp1.x = a / 2;  pp2.x = a / 2;
				makeVent(pp1, vx, -vy, min(b, h) / 6);  makeHSym(pp2, vx, vz, min(b, h) / 6, ftype);
				break;
			};
		};

	return 0;
	};

short CGeneralBlockCreator :: makeDC()
	{
	ads_real a, a1, b;
	ads_real h, h1;
	ads_real num;

	get_val("A", a);
	get_val("A1", a1);
	get_val("B", b);
	get_val("H", h);
	get_val("H1", h1);
	get_val("n", num);

	// main box
	FdPoint3d fp1(-a / 2, 0, h / 2 - h1 / 2),
	          fp2( a / 2, 0, h / 2 - h1 / 2);
	FdPoint3d cp[2]= { fp1, fp2 };
	// inversion...
	double tabWidth[2] = { h1, h1 };
	double tabHeight[2] = { b, b };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };
#ifndef FIX_BRX
	makeBox(1, cp, tabWidth, tabHeight, sides, con, true, true);
#else
	bool _sides[4] = { false, false, false, false };
	makeBox(1, cp, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, cp, tabWidth, tabHeight, _sides, con, false, true);
#endif

	// 4 small boxes
	tabWidth[0] = a1;  tabHeight[0] = a1;
	tabWidth[1] = a1;  tabHeight[1] = a1;
	fp1.set(-a / 2 + a1 / 2, b / 2 - a1 / 2,  h / 2 - h1);
	fp2.set(-a / 2 + a1 / 2, b / 2 - a1 / 2, -h / 2);
	cp[0] = fp1;  cp[1] = fp2;
#ifndef FIX_BRX
	makeBox(1, cp, tabWidth, tabHeight, sides, con, true, true);
#else
	makeBox(1, cp, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, cp, tabWidth, tabHeight, _sides, con, false, true);
#endif

	fp1.set(-a / 2 + a1 / 2, -b / 2 + a1 / 2,  h / 2 - h1);
	fp2.set(-a / 2 + a1 / 2, -b / 2 + a1 / 2, -h / 2);
	cp[0] = fp1;  cp[1] = fp2;
#ifndef FIX_BRX
	makeBox(1, cp, tabWidth, tabHeight, sides, con, true, true);
#else
	makeBox(1, cp, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, cp, tabWidth, tabHeight, _sides, con, false, true);
#endif

	fp1.set(a / 2 - a1 / 2, -b / 2 + a1 / 2,  h / 2 - h1);
	fp2.set(a / 2 - a1 / 2, -b / 2 + a1 / 2, -h / 2);
	cp[0] = fp1;  cp[1] = fp2;
#ifndef FIX_BRX
	makeBox(1, cp, tabWidth, tabHeight, sides, con, true, true);
#else
	makeBox(1, cp, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, cp, tabWidth, tabHeight, _sides, con, false, true);
#endif

	fp1.set(a / 2 - a1 / 2, b / 2 - a1 / 2,  h / 2 - h1);
	fp2.set(a / 2 - a1 / 2, b / 2 - a1 / 2, -h / 2);
	cp[0] = fp1;  cp[1] = fp2;
#ifndef FIX_BRX
	makeBox(1, cp, tabWidth, tabHeight, sides, con, true, true);
#else
	makeBox(1, cp, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, cp, tabWidth, tabHeight, _sides, con, false, true);
#endif

	if( num > 0 )
		{
		int i;
		double dia = b * 0.8;
		double adia = 0.8 * a / num;
		if( adia < dia ) dia = adia;
		double offs = (a - num * dia) / (num + 1);
		FdPoint3d p1;
		for( i = 0; i < num; i++ )
			{
			p1.set(-a / 2 + offs + i * (dia + offs) + dia / 2, 0, h / 2);
			makeSymbolicCircle(p1, vz, dia);
			};
		};

	return 0;
	};

short CGeneralBlockCreator :: makeRC()
	{
	short ftype;
	get_val("ftype", ftype);
	ads_real a, b, h;

	get_val("A", a);
	get_val("B", b);
	get_val("H", h);

	ads_real min, max;
	if( a < b )
		{  min = 2 * a / 6;  max = b / 6;  }
	else
		{  min = 2 * b / 6;  max = a / 6;  };
	ads_real symsize = min < max ? min : max;

	FdPoint3d fp1(-b / 2, 0, 0),
	          fp2( b / 2, 0, 0);
	FdPoint3d fp[2] = { fp1, fp2 };
	double tabWidth[2] = { h, h };
	double tabHeight[2] = { a, a };
	makeBox(1, fp, tabWidth, tabHeight, true);

	// adding symbols
	FdPoint3d pc(0, 0, h / 2);
	makeHSym(pc, vz, vy, symsize, ftype);
	pc.z = -h / 2;
	makeHSym(pc, vz, vy, symsize, ftype);

	pc.set(0, a / 2, 0);
	makeHSym(pc, vy, vz, symsize, ftype);
	pc.y = -a / 2;
	makeHSym(pc, vy, vz, symsize, ftype);

	addRectangularConnector(fp1, vx, vy, a + 2 * RCFlange, h + 2 * RCFlange);
	addRectangularConnector(fp2, vx, vy, a + 2 * RCFlange, h + 2 * RCFlange);

	return 0;
	};

short CGeneralBlockCreator :: makeRH()
	{
	short ftype = 1;
	ads_real a, b, h;

	get_val("A", a);
	get_val("B", b);
	get_val("H", h);

	ads_real min, max;
	if( a < b )
		{  min = 2 * a / 6;  max = b / 6;  }
	else
		{  min = 2 * b / 6;  max = a / 6;  };
	ads_real symsize = min < max ? min : max;

	FdPoint3d fp1(-b / 2, 0, 0),
	          fp2( b / 2, 0, 0);
	FdPoint3d fp[2] = { fp1, fp2 };
	double tabWidth[2] = { h, h };
	double tabHeight[2] = { a, a };
	makeBox(1, fp, tabWidth, tabHeight, true);

	addRectangularConnector(fp1, vx, vy, a + 2 * RCFlange, h + 2 * RCFlange);
	addRectangularConnector(fp2, vx, vy, a + 2 * RCFlange, h + 2 * RCFlange);

	// adding symbols
	FdPoint3d pc(0, 0, h / 2);
	makeHSym(pc, vz, vy, symsize, ftype);
	pc.z = -h / 2;
	makeHSym(pc, vz, vy, symsize, ftype);

	pc.set(0, a / 2, 0);
	makeHSym(pc, vy, vz, symsize, ftype);
	pc.y = -a / 2;
	makeHSym(pc, vy, vz, symsize, ftype);

	return 0;
	};

short CGeneralBlockCreator :: makeBC()
	{
	ads_real a, b, h, d;
	get_val("A", a);
	get_val("B", b);
	get_val("H", h);
	get_val("diam", d);

	int cnt, max;
	ads_real offs = 60;
	ads_real thck = 1.5 * d;

	FdPoint3d fp1(-a / 2 + thck / 2, b / 2 - thck / 2,  h / 2),
	          fp2(-a / 2 + thck / 2, b / 2 - thck / 2, -h / 2);
	FdPoint3d fp[2] = { fp1, fp2 };
	double tabWidth[2] = { thck, thck };
	double tabHeight[2] = { thck, thck };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };
#ifndef FIX_BRX
	makeBox(1, fp, tabWidth, tabHeight, sides, con, true, true);
#else
	bool _sides[4] = { false, false, false, false };
	makeBox(1, fp, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, fp, tabWidth, tabHeight, _sides, con, false, true);
#endif
	fp1.x = a / 2 - thck / 2;
	fp2.x = a / 2 - thck / 2;
	fp[0] = fp1;  fp[1] = fp2;
#ifndef FIX_BRX
	makeBox(1, fp, tabWidth, tabHeight, sides, con, true, true);
#else
	makeBox(1, fp, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, fp, tabWidth, tabHeight, _sides, con, false, true);
#endif

	FdPoint3d cp1, cp2, cp[2];
	for( max = (int) floor(h / offs), cnt = 0; cnt < max; cnt++ )
		{
		double y = (max - 1 - 2 * cnt) * offs / 2;
		cp1.set(-a / 2 + b - thck, b / 2 - thck, y);
		cp2.set( a / 2 - b + thck, b / 2 - thck, y);
		makeDonutSection(cp1,  vz, -vx, b - 1.5 * thck, thck, 90, cpx, cpx);
		makeDonutSection(cp2, -vz,  vx, b - 1.5 * thck, thck, 90, cpx, cpx);
		cp1.set(-a / 2 + thck / 2 + b - 1.5 * thck, -b / 2 + thck / 2, y);
		cp2.set( a / 2 - thck / 2 - b + 1.5 * thck, -b / 2 + thck / 2, y);
		cp[0] = cp1;  cp[1] = cp2;
		makeSimpleTube(cp, thck, thck, cpx);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeFHS()
	{
	ads_real a, b, h = 50;

	get_val("A", a);
	get_val("B", b);

	FdPoint3d fp1(0, 0,  h / 2),
	          fp2(0, 0, -h / 2);
	FdPoint3d fp[2] = { fp1, fp2 };
	double tabWidth[2] = { a, a };
	double tabHeight[2] = { b, b };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };
#ifndef FIX_BRX
	makeBox(1, fp, tabWidth, tabHeight, sides, con, true, true);
#else
	bool _sides[4] = { false, false, false, false };
	makeBox(1, fp, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, fp, tabWidth, tabHeight, _sides, con, false, true);
#endif

	// adding cross lines
	FdPoint3d lp1, lp2, lp3, lp4;
	lp1 = fp1 + vy * b / 2 - vx * a / 2;
	lp2 = fp1 + vy * b / 2 + vx * a / 2;
	lp3 = fp1 - vy * b / 2 + vx * a / 2;
	lp4 = fp1 - vy * b / 2 - vx * a / 2;

	// addThinLine(lp1, lp3);
	// addThinLine(lp2, lp4);

	lp1 = fp2 + vy * b / 2 - vx * a / 2;
	lp2 = fp2 + vy * b / 2 + vx * a / 2;
	lp3 = fp2 - vy * b / 2 + vx * a / 2;
	lp4 = fp2 - vy * b / 2 - vx * a / 2;

	// addThinLine(lp1, lp3);
	// addThinLine(lp2, lp4);


	fp1.set(0, a / 4, h / 2);
	makeHSym(fp1, vz, vy, min(a, b) / 8, 1);
	fp1.z = -h / 2;
	makeHSym(fp1, vz, vy, min(a, b) / 8, 1);

	return 0;
	};

short CGeneralBlockCreator :: makeHBSB()
	{
	ads_real a, b, h;

	get_val("A", a);
	get_val("B", b);
	get_val("H", h);

	FdPoint3d fp1(0, 0, h / 2), fp2(0, 0, -h / 2);
	FdPoint3d fp[2] = { fp1, fp2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };
#ifndef FIX_BRX
	makeBox(1, fp, tabWidth, tabHeight, sides, con, true, true);
#else
	bool _sides[4] = { false, false, false, false };
	makeBox(1, fp, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, fp, tabWidth, tabHeight, _sides, con, false, true);
#endif

	fp1.set(0, 0, h / 2);  fp2.set(0, 0, -h / 2);
	makeHSym(fp1, vz, vx, min(a, b) / 8, 1);
	makeHSym(fp2, vz, vx, min(a, b) / 8, 1);

	fp1.set(0, b / 2, 0);  fp2.set(0, -b / 2, 0);
	makeHSym(fp1, vy, vx, min(a, h) / 8, 1);
	makeHSym(fp2, vy, vx, min(a, h) / 8, 1);

	fp1.set(a / 2, 0, 0);  fp2.set(-a / 2, 0, 0);
	makeHSym(fp1, vx, vy, min(h, b) / 8, 1);
	makeHSym(fp2, vx, vy, min(h, b) / 8, 1);

	return 0;
	};

short CGeneralBlockCreator :: makePC()
	{
	ads_real a, b, h;

	get_val("A", a);
	get_val("B", b);
	get_val("H", h);

	FdPoint3d fp1(0, 0,  h / 2),
	          fp2(0, 0, -h / 2);
	FdPoint3d fp[2] = { fp1, fp2 };
	double tabWidth[2] = { b, b };
	double tabHeight[2] = { a, a };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };
#ifndef FIX_BRX
	makeBox(1, fp, tabWidth, tabHeight, sides, con, true, true);
#else
	bool _sides[4] = { false, false, false, false };
	makeBox(1, fp, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, fp, tabWidth, tabHeight, _sides, con, false, true);
#endif

	// setpt(p1,  -a / 2,   b / 2,   h / 2);  setpt(p2,   a / 2,   b / 2,   h / 2);
	// setpt(p3,   a / 2,  -b / 2,   h / 2);  setpt(p4,  -a / 2,  -b / 2,   h / 2);
	// make_polygon(p1, p2, p4, p3);
	// setpt(p1,  -a / 2,   b / 2,  -h / 2);  setpt(p2,   a / 2,   b / 2,  -h / 2);
	// setpt(p3,   a / 2,  -b / 2,  -h / 2);  setpt(p4,  -a / 2,  -b / 2,  -h / 2);
	// make_polygon(p1, p2, p4, p3);

	// POLYGON does not work
	// setpt(p1,  -a / 2,   b / 2,   h / 2);  setpt(p2,  -a / 2,  -b / 2,   h / 2);
	// setpt(p3,  -a / 2,   b / 2,  -h / 2);  setpt(p4,  -a / 2,  -b / 2,  -h / 2);
	// make_polygon(p1, p2, p4, p3);
	// setpt(p1,   a / 2,   b / 2,   h / 2);  setpt(p2,   a / 2,  -b / 2,   h / 2);
	// setpt(p3,   a / 2,   b / 2,  -h / 2);  setpt(p4,   a / 2,  -b / 2,  -h / 2);
	// make_polygon(p1, p2, p4, p3);

	return 0;
	};

short CGeneralBlockCreator :: makeTANK()
	{
	ads_real a, b, h, d, D;
	ads_real diam1, diam2;
	short elType;

	get_val("A", a);
	get_val("B", b);
	get_val("H", h);
	get_val("d", d);

	get_val("D", D);
	get_val("diam2", diam2);
	get_val("diam1", diam1);

	get_val("elType", elType);

	switch( elType )
		{
		case 0:  // PHE
			{
			FdPoint3d fp1(-a / 2, 0, 0),
			          fp2( a / 2, 0, 0);
			FdPoint3d fp[2] = { fp1, fp2 };
			double tabWidth[2] = { h, h };
			double tabHeight[2] = { b, b };
			bool sides[4] = { true, true, true, true };
			bool con[2] = { false, false };
#ifndef FIX_BRX
			makeBox(1, fp, tabWidth, tabHeight, sides, con, true, true);
#else
			bool _sides[4] = { false, false, false, false };
			makeBox(1, fp, tabWidth, tabHeight, sides, con, true, false);
			makeBox(1, fp, tabWidth, tabHeight, _sides, con, false, true);
#endif
			};  break;
		case 1:  // BT, FCO, STHE
			{
			short elType3d;
			get_val("elType3d", elType3d);

			switch( (int) elType3d )
				{
				case 1:  // STHE
					{
					FdPoint3d fp1(0, -h / 2 + D / 2 - 0.01, 0),
					          fp2(0,  h / 2 - D / 2 + 0.01, 0);
					FdPoint3d fp[2] = { fp1, fp2 };
					makeSimpleTube(fp, D, D, cpx);

					int n[2] = { cpx, 4 * cpx };
					double latAngles[2] = { 0, 90 };
					double longAngles[2] = { 0, 360 };
					double axisLengths[3] = { D, D, D };
					makeSpheroidSection(fp1, vy, latAngles, longAngles, axisLengths, n);

					double latAngles2[2] = { 0, 180 };
					double longAngles2[2] = { 0, 180 };
					makeSpheroidSection(fp2, vz, latAngles2, longAngles2, axisLengths, n);
					};  break;

				case 2:  // FCO
					{
					FdPoint3d fp1(0, -h / 2 + D / 2 - 0.01, 0),
					          fp2(0,  h / 2 - D / 2 + 0.01, 0);
					FdPoint3d fp[2] = { fp1, fp2 };
					makeSimpleTube(fp, D, D, cpx);

					int n[2] = { cpx, 4 * cpx };
					double latAngles[2] = { 0, 90 };
					double longAngles[2] = { 0, 360 };
					double axisLengths[3] = { D, D, D };
					makeSpheroidSection(fp1, vy, latAngles, longAngles, axisLengths, n);

					double latAngles2[2] = { 0, 180 };
					double longAngles2[2] = { 0, 180 };
					makeSpheroidSection(fp2, vz, latAngles2, longAngles2, axisLengths, n);
					};  break;

				case 3:  // BT
					{
					FdPoint3d fp1(0, -h / 2 + D / 2 - 0.01, 0),
					          fp2(0,  h / 2 - D / 2 + 0.01, 0);
					FdPoint3d fp[2] = { fp1, fp2 };
					makeSimpleTube(fp, D, D, cpx);

					int n[2] = { cpx, 4 * cpx };
					double latAngles[2] = { 0, 90 };
					double longAngles[2] = { 0, 360 };
					double axisLengths[3] = { D, D, D };
					makeSpheroidSection(fp1, vy, latAngles, longAngles, axisLengths, n);

					double latAngles2[2] = { 0, 180 };
					double longAngles2[2] = { 0, 180 };
					makeSpheroidSection(fp2, vz, latAngles2, longAngles2, axisLengths, n);
					};  break;
				};
			};  break;

		case 2:  // EV
			{
			FdPoint3d fp1(0, -h / 2 + D / 2 - 0.01, 0),
			          fp2(0,  h / 2 - D / 2 + 0.01, 0);
			FdPoint3d fp[2] = { fp1, fp2 };
			makeSimpleTube(fp, D, D, cpx);

			int n[2] = { 2 * cpx, 4 * cpx };
			double latAngles[2] = { 0, 90 };
			double longAngles[2] = { 0, 360 };
			double axisLengths[3] = { D, D, D };
			makeSpheroidSection(fp1, vy, latAngles, longAngles, axisLengths, n);

			double latAngles2[2] = { 0, 180 };
			double longAngles2[2] = { 0, 180 };
			makeSpheroidSection(fp2, vz, latAngles2, longAngles2, axisLengths, n);
			};  break;
		};

	return 0;
	};

short CGeneralBlockCreator :: makePUMP()
	{
	ads_real elType;
	double L = 125, diam = 25, ndiam = 5;

	get_val("L", L);
	get_val("elType", elType);
	// pobieraj wartoњж diam :)
	get_val("diam", ndiam);
	get_ext_diam("L1", diam);
	if( diam <= 0 )
		diam = ndiam;

	// new variables
	// D1 = 0.8 * D2;
	double D2 = 100, L1 = 100, L2 = 50, D1 = 80;
	get_val("L1",L1);
	get_val("L2",L2);
	get_val("D1",D1);
	get_val("D2",D2);

	double L3 = 808.5;
	double L4 = 192.5;
	double L5 = 385;
	if( (int) elType == 1 )
		{
		get_val("D3", L3);
		get_val("D2", L5);
		get_val("L3", L4);
		};

	// additional non-PNR variable: height of element
	double H = L1 + L2;

	switch( (int) elType )
		{
		case 0:  // IP
			{
			FdPoint3d p1(0, 0, L1 + L2 / 2),
			          p2(0, 0,      L2 / 2);
			FdPoint3d p[4] = { p1, p1, p2, p2 };
			double diams[4] = { 0, D1, D1, D2 };
			makeUniVectorTube(p, -vz, diams, cpx, 3);

			makeVent(p1, vz, -vy, D1 / 2, true);

			p1.z = -L2 / 2;
			p[0] = p1;  p[1] = p2;
			makeSimpleTube(p, D2, D2, cpx);

			p[0] = p1;  p[1] = p1;  diams[1] = D2;
			makeUniVectorTube(p, vz, diams, cpx, 1);
			};  break;

		case 2:  // RP
			{
			FdPoint3d p1(0, 0, -L2 / 2),
			          p2(0, 0,  L2 / 2),
			          p3(0, 0,  L2 / 2 + L1);
			FdPoint3d p[6] = { p1, p1, p2, p2, p3, p3 };
			double diams[6] = { 0, D2, D2, D1, D1, 0 };
			makeUniVectorTube(p, vz, diams, cpx, 5);

			makeVent(p3, vz, -vy, D1 / 2, true);
			};  break;

		case 1:  // TP
			{
			FdPoint3d p1(-L3 / 2 + D2 / 2, 0,  L1 + L2 / 2),
			          p2(-L3 / 2 + D2 / 2, 0,       L2 / 2),
			          p3(-L3 / 2 + D2 / 2, 0,     - L2 / 2 + L4);
			FdPoint3d p[5] = { p1, p1, p2, p2, p3 };
			double diams[5] = { 0, D1, D1, D2, D2 };
			makeUniVectorTube(p, -vz, diams, cpx, 4);
			makeVent(p1, vz, -vy, D1 / 2, true);

			p1.x = p2.x = p3.x = p3.x = L3 / 2 - D2 / 2;
			p[0] = p1;  p[1] = p1;  p[2] = p2;  p[3] = p2;  p[4] = p3;
			makeUniVectorTube(p, -vz, diams, cpx, 4);
			makeVent(p1, vz, -vy, D1 / 2, true);

			p1.set(-L3 / 2 + D2 / 2, 0, -L2 / 2 + L4 / 2);
			p2.set( L3 / 2 - D2 / 2, 0, -L2 / 2 + L4 / 2);
			p[0] = p1;  p[1] = p2;
			double tabWidth[2] = { L4, L4 };
			double tabHeight[2] = { D2, D2 };
			bool sides[4] = { true, true, true, true };
			bool con[2] = { false, false };
#ifndef FIX_BRX
			makeBox(1, p, tabWidth, tabHeight, sides, con, true, true);
#else
			bool _sides[4] = { false, false, false, false };
			makeBox(1, p, tabWidth, tabHeight, sides, con, true, false);
			makeBox(1, p, tabWidth, tabHeight, _sides, con, false, true);
#endif

			p1.set(-L3 / 2 + D2 / 2, 0, -L2 / 2 + L4);
			p2.set(-L3 / 2 + D2 / 2, 0, -L2 / 2);

			p[0] = p1;  p[1] = p2;  p[2] = p2;
			FdVector3d v[3] = { -vz, -vz, -vz };
			double diamsT[3][2] = { D2, D2, D2, D2, 0, 0 };
			makeTube(p, v, diamsT, cpx, 2, false, true);

			p1.set( L3 / 2 - D2 / 2, 0, -L2 / 2 + L4);
			p2.set( L3 / 2 - D2 / 2, 0, -L2 / 2);
			p[0] = p1;  p[1] = p2;  p[2] = p2;
			diamsT[0][0] = diamsT[0][1] = diamsT[1][0] = diamsT[1][1] = D2;
			diamsT[2][0] = diamsT[2][1] = 0;
			makeTube(p, v, diamsT, cpx, 2, false, true);
			};  break;
		};

	return 0;
	};

short CGeneralBlockCreator :: makeAVT()
	{
	postTransformMesh(ARX_PI / 2, FdVector3d::kXAxis);
	postTransformMesh(ARX_PI, FdVector3d::kZAxis);

	ads_real diam, dext;
	get_val("diam", diam);

	// new variables
	double D1 = 1.5 * diam, D2 = diam / 10, D3 = diam / 5;
	double L = 2 * diam, L1 = diam, L2 = L / 5, L3 = L / 6;
	// D1 = bigger tube diam, L - bigger tube length;
	// L1 smaller tube length, diam - smaller tube diam
	// D2,D3 - smaller and bigger diameter of "small part"
	// L2,L3 - longer and shorter length of "small part"
	get_val("D1", D1);
	get_val("H1", L);
	get_val("d2", D2);
	get_val("d1", D3);
	get_val("h", L2);
	get_val("h1", L3);
	get_val("H", L1);
	get_val("dext", dext);
	L1 = L1 - L;

	double H = L;
	FdPoint3d p1(0, 0,  H / 2),
	          p2(0, 0, -H / 2),
	          p3(0, 0, -H / 2);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	double diams[4] = { 0, D1, D1, dext };
	makeUniVectorTube(p, -vz, diams, cpx, 3);

	FdPoint3d sp1(-diam / 4, -diam / 4, H / 2),
	          sp2(-diam / 4, -diam / 4, H / 2 + L2),
	          sp3(-diam / 4, -diam / 4, H / 2 + L2 + L3);
	FdPoint3d sp[5] = { sp1, sp2, sp2, sp3, sp3 };
	double sdiams[5] = { D2, D2, D3, D3, 0 };
	makeUniVectorTube(sp, vz, sdiams, cpx, 4);

	return 0;
	};

short CGeneralBlockCreator :: make2WayValve()
	{
	short elType;
	ads_real ndiam = 100, diam = 100, L = 500;

	get_val("diam", ndiam);
	get_val("L", L);
	get_val("elType", elType);
	get_ext_diam("L1", diam);
	if( diam <= 0 )
		diam = ndiam;

	switch( elType )
		{
		case 0:  // TCOV
			{
			// additional variables
			double l, l1, l2, l3, l4, alfa = 45, C = 5, SW = 15;

			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("l3", l3);
			get_val("l4", l4);
			get_val("alfa", alfa);
			get_val("C", C);
			get_val("SW", SW);
			get_val("dext", diam);

			// make screw
			FdPoint3d p1, p2, p3;
			p1.set(-L / 2, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, false);
			makeScrew2(p1, vx, vz, SW, C, true);

			// make tube
			p1.set(-L / 2 + C, 0, 0);
			double tubeData[2] = { diam, L - 2 * C };
			double interTubeData[4] = { l4, l3, (L - 2 * C) / 2, 0 };
			double angles[2] = { 0, 0 };
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

			// make screw
			p2.set( L / 2 - C, 0, 0);
			makeScrew2(p2, vx, vz, SW, C, false);
			makeScrew2(p2, vx, vz, SW, C, true);

			// closing tubes
			// right
			p1.set( L / 2 - C, 0, 0);
			FdPoint3d p[2] = { p1, p1 };
			double diams[2] = { diam, 0.01 };
			makeUniVectorTube(p, vx, diams, cpx, 1);

			// left
			p2.set(-L / 2 + C, 0, 0);
			p[0] = p2;  p[1] = p2;
			makeUniVectorTube(p, vx, diams, cpx, 1);

			// top
			p1.set(0, 0, l3);
			p[0] = p1;  p[1] = p1;  diams[0] = l4;
			makeUniVectorTube(p, vz, diams, cpx, 1);

			// funny box bend part :D
			double beta = 90 - alfa;

			// conversion deg->rad :)
			alfa = alfa * (ARX_PI / 180);
			beta = beta * (ARX_PI / 180);

			FdVector3d v1(-cos(beta) * l2, 0, sin(beta) * l2);
			FdVector3d v2(tan(beta) * (l2 - v1.z), 0, l2 - v1.z);
			FdVector3d v, vv(cos(alfa) * l, 0, sin(alfa) * l), temp(l1, 0, -l2 / 2), vt;
			v = v1 + v2;
			vt = v.crossProduct(-vy);
			p1.set(0, 0, l3);
			p1 += v / 2.0;
			p2 = p1;
			p2 += vv;
			p3 = p1 + v / 2.0 + vv + temp;

			double len = sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
			FdPoint3d cp[3] = { p1, p2, p3 };
			FdVector3d cv[3] = { vt, vt, vx };
			FdVector3d cuv[3] = { vv.perpVector(), vv.perpVector(), vy };

			double tabWidth[3] = { len, len, l2 };
			double tabHeight[3] = { l4, l4, l4 };
			bool sides[8] = { true, true, true, true,
			                  true, true, true, true };
			makeBox(2, cp, cv, cuv, tabWidth, tabHeight, sides, false, true, 5, 5, 20);

			p1.set(0, 0, l3);
			p2.set(0, 0, l3 + l2);
			p3.set(0, 0, l3 + l2);
			cp[0] = p1;  cp[1] = p2;  cp[2] = p3;
			cv[0] = cv[1] = cv[2] = vz;
			cuv[0] = cuv[1] = cuv[2] = vy;
			double diamx[3][2] = { l4, l4, l4, l4, 0.01, 0.01 };
			makeTube(cp, cv, cuv, diamx, cpx, 2, true, true);
			};  break;

		case 1:  // CCOV
			{
			// we substract flange from "L"
			L -= 2 * GetFlgThick("L1");

			// additional variables
			double l, l1, l2, l3, R;
			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("l3", l3);
			get_val("dext", diam);

			// get_val("R", R);
			R = l1 / 2;

			// make main tube
			FdPoint3d p1, p2, p3;
			p1.set(-L / 2.0, 0, 0);
			double tubeData[2] = { diam, L };
			double interTubeData[4] = { l1, l3, L / 2, 0 };
			double angles[2] = { 0, 0 };
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

			// closing tubes
			// right
			p1.set( L / 2.0, 0, 0);
			FdPoint3d p[2] = { p1, p1 };
			double diams[2] = { diam, 0.1 };
			makeUniVectorTube(p, vx, diams, cpx, 1);

			// left
			p2.set(-L / 2.0, 0, 0);
			p[0] = p2;  p[1] = p2;
			makeUniVectorTube(p, vx, diams, cpx, 1);

			// top
			p1.set(0, 0, l3);
			p[0] = p1;  p[1] = p1;  diams[0] = l1;
			makeUniVectorTube(p, vz, diams, cpx, 1);

			// make box part
			p1.set(0, 0, l3 + l2 / 2);
			p2.set(l - l1, 0, l3 + l2 / 2);
			p[0] = p1;  p[1] = p2;
			double tabWidth[2] = { l2, l2 };
			double tabHeight[2] = { l1, l1 };
			makeBox(1, p, tabWidth, tabHeight, false);

			// half tubes
			// near intersecting tube
			p1.set(0, 0, l3);
			p2.set(0, 0, l3 + l2);
			FdPoint3d cp[4] = { p1, p2, p2, p2 };
			FdVector3d cv[4] = { vz, vz, vz, vz };
			FdVector3d cuv[4] = { vy, vy, vy, vy };
			double diamx[4][2] = { l1, l1, l1, l1, 0.01, 0.01, 0.01, 0.01 };
			makeTube(cp, cv, cuv, diamx, cpx, 2, true, true);

			// together with the end of the box
			p1.set(l - l1, 0, l3);
			p2.set(l - l1, 0, l3 + l2);
			cp[0] = cp[1] = p1;
			cp[2] = cp[3] = p2;
			cv[0] = cv[1] = cv[2] = cv[3] = vz;
			cuv[0] = cuv[1] = cuv[2] = cuv[3] = -vy;
			diamx[0][0] = diamx[0][1] = diamx[3][0] = diamx[3][1] = 0.01;
			diamx[1][0] = diamx[1][1] = diamx[2][0] = diamx[2][1] = l1;
			makeTube(cp, cv, cuv, diamx, cpx, 3, true, true);
			};  break;

		case 2:  // TNRV
			{
			// additional variables
			double C = 5, SW = 15;
			get_val("dext", diam);
			get_val("C", C);
			get_val("SW", SW);

			// make screw
			FdPoint3d p1, p2;
			p1.set(-L / 2, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, true);
			makeScrew2(p1, vx, vz, SW, C, false);

			// make tube
			p1.set(-L / 2 + C, 0, 0);
			p2.set( L / 2 - C, 0, 0);
			FdPoint3d p[4] = { p1, p1, p2, p2 };
			double diams[4] = { 0.01, diam, diam, 0.01 };
			makeUniVectorTube(p, vx, diams, cpx, 3);

			// make screw
			p2.set( L / 2 - C, 0, 0);
			makeScrew2(p2, vx, vz, SW, C, true);
			makeScrew2(p2, vx, vz, SW, C, false);
			};  break;

		case 3:  // CNRV
			{
			// we substract flange from "L"
			L -= 2 * GetFlgThick("L1");
			get_val("dext", diam);

			// additional variables
			double l, d;
			get_val("l", l);
			get_val("d", d);

			double ll = (L - l) / 2;
			FdPoint3d p1(-L / 2,      0, 0),
			          p2(-L / 2 + ll, 0, 0),
			          p3( L / 2 - ll, 0, 0),
			          p4( L / 2,      0, 0);
			FdPoint3d p[6] = { p1, p2, p2, p3, p3, p4 };
			double diams[6] = { diam, diam, d, d, diam, diam };
			makeUniVectorTube(p, vx, diams, cpx, 5);
			};  break;

		case 4:  // TTHV
			{
			// additional variables
			double l = 400, l1 = 100, l2 = 100, alfa = 60, d = 80, d1 = 50, C = 20, SW = 100;

			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("alfa", alfa);
			get_val("d", d);
			get_val("d1", d1);
			get_val("C",C);
			get_val("SW",SW);
			get_val("dext", diam);

			L -= 2 * C;
			double alfa2 = alfa * (ARX_PI / 180);
			double moveMain = (diam / 2) / tan(alfa2);

			double ll = l - l1 - l2;
			FdPoint3d p1(-L / 2, 0, 0), p2, p3;
			double tubeParams[3] = { diam, diam, L };
			double interTubePosition[2] = { L / 2 + moveMain, 0 };
			double interTubeParameters[3] = { ll, d1, d1 };
			double angles[3] = { alfa, 90, 0 };
			int n[2] = { cpx, cpx };
			bool opt[3] = { false, false, false };
			makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

			alfa = alfa * (ARX_PI / 180);
			double w1 = l - l1 - l2;  // -w2
			FdVector3d v(-cos(alfa) * w1, 0, sin(alfa) * w1);
			p1.set(0, 0, 0);  p1 += v;
			p2 = p1;  v.normalize();  v *= l2;  p2 += v;
			p3 = p2;  v.normalize();  v *= l1;  p3 += v;
			p1.x += moveMain;
			p2.x += moveMain;
			p3.x += moveMain;

			FdPoint3d p[6] = { p1, p1, p2, p2, p3, p3 };
			double tdiams[6] = { d1, d / 2, d / 2, d, d, 0.01 };
			makeUniVectorTube(p, v, tdiams, cpx, 5);

			// adding screws
			p1.set(-L / 2 - C, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, true);
			makeScrew2(p1, vx, vz, SW, C, false);
			p1.set( L / 2, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, true);
			makeScrew2(p1, vx, vz, SW, C, false);

			// closing tubes
			// right
			p1.set( L / 2, 0, 0);
			p[0] = p1;  p[1] = p1;
			double diams[2] = { diam, 0.01 };
			makeUniVectorTube(p, vx, diams, cpx, 1);

			// left
			p1.set(-L / 2, 0, 0);
			p[0] = p1;  p[1] = p1;
			makeUniVectorTube(p, vx, diams, cpx, 1);
			};  break;

		case 5:  // CTHV
			{
			// we substract flange from "L"
			L -= 2 * GetFlgThick("L1");

			// additional variables
			double l = 400, l1 = 100, l2 = 100, alfa = 60, d = 80, d1 = 50;

			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("alfa", alfa);
			get_val("d", d);
			get_val("d1", d1);
			get_val("dext", diam);

			double alfa2 = alfa * (ARX_PI / 180);
			double moveMain = (diam / 2) / tan(alfa2);

			double ll = l - l1 - l2;
			FdPoint3d p1(-L / 2, 0, 0), p2, p3;
			double tubeParams[3] = { diam, diam, L };
			double interTubePosition[2] = { L / 2 + moveMain, 0 };
			double interTubeParameters[3] = { ll, d1, d1 };
			double angles[3] = { alfa, 90, 270 };
			int n[2] = { cpx, cpx };
			bool opt[3] = { false, false, false };
			makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

			// big joint
			alfa = alfa * (ARX_PI / 180);
			double w1 = l - l1 - l2;  // -w2
			FdVector3d v(-cos(alfa) * w1, sin(alfa) * w1, 0);
			p1.set(0, 0, 0);  p1 += v;
			p2 = p1;  v.normalize();  v *= l2;  p2 += v;
			p3 = p2;  v.normalize();  v *= l1;  p3 += v;
			p1.x += moveMain;
			p2.x += moveMain;
			p3.x += moveMain;

			FdPoint3d p[6] = { p1, p1, p2, p2, p3, p3 };
			double tdiams[6] = { d1, d / 2, d / 2, d, d, 0.01 };
			makeUniVectorTube(p, v, tdiams, cpx, 5);
			};  break;

		case 6:  // TTHMV
			{
			// additional variables
			double l = 400, l1 = 100, l2 = 100, alfa = 60, d = 80, d1 = 50, C = 20, SW = 100;
			double l3 = 10, l4 = 150, l5 = 150, beta = 45, gamma = 45;

			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("alfa", alfa);
			get_val("d", d);
			get_val("d1", d1);
			get_val("SW",SW);
			get_val("C",C);
			get_val("l3",l3);
			get_val("l4",l4);
			get_val("beta", beta);
			get_val("gamma",gamma);
			get_val("l5", l5);
			get_val("dext", diam);

			L -= 2 * C;
			double alfa2 = alfa * (ARX_PI / 180);
			double moveMain = (diam / 2) / tan(alfa2);

			// main tube and main joint
			double ll = l - l1 - l2;
			FdPoint3d p1(-L / 2, 0, 0), p2, p3;
			double tubeParams[3] = { diam, diam, L };
			double interTubePosition[2] = { L / 2 + moveMain, 0 };
			double interTubeParameters[3] = { ll, d1, d1 };
			double angles[3] = { alfa, 90, 0 };
			int n[2] = { cpx, cpx };
			bool opt[3] = { false, false, false };
			makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

			// two smaller joints
			interTubePosition[0] = L / 2 + l5;
			interTubeParameters[0] = l4 - l3;
			interTubeParameters[1] = d / 4;
			interTubeParameters[2] = d / 4;
			angles[0] = 90 + beta;
			angles[1] = 90;
			angles[2] = gamma;
			opt[2] = true;
			makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

			angles[2] = -gamma;
			makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

			// big joint
			alfa = alfa * (ARX_PI / 180);
			double w1 = l - l1 - l2;  // -w2
			FdVector3d v(-cos(alfa) * w1, 0, sin(alfa) * w1);
			p1.set(0, 0, 0);  p1 += v;
			p2 = p1;  v.normalize();  v *= l2;  p2 += v;
			p3 = p2;  v.normalize();  v *= l1;  p3 += v;
			p1.x += moveMain;
			p2.x += moveMain;
			p3.x += moveMain;

			FdPoint3d p[6] = { p1, p1, p2, p2, p3, p3 };
			double tdiams[6] = { d1, d / 2, d / 2, d, d, 0.01 };
			makeUniVectorTube(p, v, tdiams, cpx, 5);

			// closing small joints
			// ARX model!!! Has to be changed!!!
			// Rotation required in FdVector3d class
			FdPoint3d ap1(l5, 0, 0), ap2(l5, 0, 0);
			FdVector3d avx(1, 0, 0), avy(0, 1, 0), avr(0, 0, 1);

			// joint one :D
			beta = beta * (ARX_PI / 180);
			gamma = gamma * (ARX_PI / 180);
			avr.rotateBy(beta, avy);
			avr.rotateBy(gamma, avx);
			avr.normalize();  avr *= l4 - l3;  ap1 += avr;
			avr.normalize();  avr *= l4;       ap2 += avr;
			p1.set(ap1.x, ap1.y, ap1.z);
			p2.set(ap2.x, ap2.y, ap2.z);
			v.set(avr.x, avr.y, avr.z);
			p[0] = p1;  p[1] = p1;  p[2] = p2;  p[3] = p2;
			tdiams[0] = d / 4;
			tdiams[1] = d / 3;
			tdiams[2] = d / 3;
			tdiams[3] = 0.01;
			makeUniVectorTube(p, v, tdiams, cpx, 3);

			// joint two :)
			avr.set(0, 0, 1);
			ap1.set(l5, 0, 0);
			ap2.set(l5, 0, 0);
			avr.rotateBy(beta, avy);
			avr.rotateBy(-gamma, avx);
			avr.normalize();
			avr *= l4 - l3;
			ap1 += avr;
			avr.normalize();
			avr *= l4;
			ap2 += avr;
			p1.set(ap1.x, ap1.y, ap1.z);
			p2.set(ap2.x, ap2.y, ap2.z);
			v.set(avr.x, avr.y, avr.z);
			p[0] = p1;  p[1] = p1;  p[2] = p2;  p[3] = p2;
			tdiams[0] = d / 4;
			tdiams[1] = d / 3;
			tdiams[2] = d / 3;
			tdiams[3] = 0.01;
			makeUniVectorTube(p, v, tdiams, cpx, 3);

			// adding screws
			p1.set(-L / 2 - C, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, true);
			makeScrew2(p1, vx, vz, SW, C, false);
			p1.set( L / 2, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, true);
			makeScrew2(p1, vx, vz, SW, C, false);

			// closing main tube
			// right
			p1.set( L / 2, 0, 0);
			p[0] = p1;  p[1] = p1;
			double diams[2] = { diam, 0.01 };
			makeUniVectorTube(p, vx, diams, cpx, 1);

			// left
			p1.set(-L / 2, 0, 0);
			p[0] = p1;  p[1] = p1;
			makeUniVectorTube(p, vx, diams, cpx, 1);
			};  break;

		case 7:  // CTHMV
			{
			// we substract flange from "L"
			L -= 2 * GetFlgThick("L1");

			// additional variables
			double l = 400, l1 = 100, l2 = 100, alfa = 60, d = 80, d1 = 50;
			double l3 = 10, l4 = 150, l5 = 150, beta = 35, gamma = 45;

			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("alfa", alfa);
			get_val("d", d);
			get_val("d1", d1);
			get_val("l3",l3);
			get_val("l4",l4);
			get_val("beta",beta);
			get_val("beta", beta);
			get_val("gamma",gamma);
			get_val("l5", l5);
			get_val("dext", diam);

			double alfa2 = alfa * (ARX_PI / 180);
			double moveMain = (diam / 2) / tan(alfa2);

			double ll = l - l1 - l2;
			FdPoint3d p1(-L / 2, 0, 0), p2, p3;
			double tubeParams[3] = { diam, diam, L };
			double interTubePosition[2] = { L / 2 + moveMain, 0 };
			double interTubeParameters[3] = { ll, d1, d1 };
			double angles[3] = { alfa, 90, 0 };
			int n[2] = { cpx, cpx };
			bool opt[3] = { false, false, false };
			makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

			interTubePosition[0] = L / 2 + l5;
			interTubeParameters[0] = l4 - l3;
			interTubeParameters[1] = d / 4;
			interTubeParameters[2] = d / 4;
			angles[0] = 90 + beta;
			angles[1] = 90;
			angles[2] = gamma;
			opt[2] = true;
			makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

			angles[2] = -gamma;
			makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

			// big joint
			alfa = alfa * (ARX_PI / 180);
			double w1 = l - l1 - l2;  // -w2
			FdVector3d v(-cos(alfa) * w1, 0, sin(alfa) * w1);
			p1.set(0, 0, 0);  p1 += v;
			p2 = p1;  v.normalize();  v *= l2;  p2 += v;
			p3 = p2;  v.normalize();  v *= l1;  p3 += v;
			p1.x += moveMain;
			p2.x += moveMain;
			p3.x += moveMain;

			FdPoint3d p[6] = { p1, p1, p2, p2, p3, p3 };
			double tdiams[6] = { d1, d / 2, d / 2, d, d, 0.01 };
			makeUniVectorTube(p, v, tdiams, cpx, 5);

			// closing small joints
			// ARX model!!! Has to be changed!!!
			// Rotation required in FdVector3d class
			FdPoint3d ap1(l5, 0, 0), ap2(l5, 0, 0);
			FdVector3d avx(1, 0, 0), avy(0, 1, 0), avr(0, 0, 1);

			// joint one :D
			beta = beta * (ARX_PI / 180);
			gamma = gamma * (ARX_PI / 180);
			avr.rotateBy(beta, avy);
			avr.rotateBy(gamma, avx);
			avr.normalize();  avr *= l4 - l3;  ap1 += avr;
			avr.normalize();  avr *= l4;       ap2 += avr;
			p1.set(ap1.x, ap1.y, ap1.z);
			p2.set(ap2.x, ap2.y, ap2.z);
			v.set(avr.x, avr.y, avr.z);
			p[0] = p1;  p[1] = p1;  p[2] = p2;  p[3] = p2;
			tdiams[0] = d / 4;
			tdiams[1] = d / 3;
			tdiams[2] = d / 3;
			tdiams[3] = 0.01;
			makeUniVectorTube(p, v, tdiams, cpx, 3);

			// joint two :)
			avr.set(0, 0, 1);
			ap1.set(l5, 0, 0);
			ap2.set(l5, 0, 0);
			avr.rotateBy(beta, avy);
			avr.rotateBy(-gamma, avx);
			avr.normalize();  avr *= l4 - l3;  ap1 += avr;
			avr.normalize();  avr *= l4;       ap2 += avr;
			p1.set(ap1.x, ap1.y, ap1.z);
			p2.set(ap2.x, ap2.y, ap2.z);
			v.set(avr.x, avr.y, avr.z);
			p[0] = p1;  p[1] = p1;  p[2] = p2;  p[3] = p2;
			tdiams[0] = d / 4;
			tdiams[1] = d / 3;
			tdiams[2] = d / 3;
			tdiams[3] = 0.01;
			makeUniVectorTube(p, v, tdiams, cpx, 3);
			};  break;

		case 8:  // T2WV
			{
			// additional variables
			double l = 50, l1 = 75, l2 = 40, L1 = 200, C = 5, SW = 15, l3 = 0;
			get_val("dext", diam);

			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("L1", L1);
			get_val("C", C);
			get_val("SW", SW);
			get_val("l3", l3);

			L -= C * 2;
			L1 -= C;

			// make tube
			FdPoint3d p1(-L / 2.0, 0, 0),
			          p2( L / 2.0, 0, 0);
			FdPoint3d p[2] = { p1, p2 };
			makeSimpleTube(p, diam, diam, cpx);

			// make box
			p1.set(-l / 2, diam / 2 + l2 / 2, l1 / 3 - l3);
			p2.set( l / 2, diam / 2 + l2 / 2, l1 / 3 - l3);
			p[0] = p1;  p[1] = p2;
			double tabWidth[2] = { l1, l1 };
			double tabHeight[2] = { l2, l2 };
			bool sides[4] = { true, true, true, true };
			bool con[2] = { false, false };
#ifndef FIX_BRX
			makeBox(1, p, tabWidth, tabHeight, sides, con, true, true);
#else
			bool _sides[4] = { false, false, false, false };
			makeBox(1, p, tabWidth, tabHeight, sides, con, true, false);
			makeBox(1, p, tabWidth, tabHeight, _sides, con, false, true);
#endif

			// making screws
			p1.set(-L / 2 - C, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, true);
			makeScrew2(p1, vx, vz, SW, C, false);

			p1.set( L / 2, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, true);
			makeScrew2(p1, vx, vz, SW, C, false);
			};  break;

		case 9:  // C2WV
			{
			// we substract flange from "L"
			L -= 2 * GetFlgSize("L1");

			// additional variables
			double l, l1, l2;
			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("dext", diam);

			FdPoint3d p1(-L / 2, 0, 0),
			          p2( L / 2, 0, 0);
			FdPoint3d p[2] = { p1, p2 };
			makeSimpleTube(p, diam, diam, cpx);

			// make box
			p1.set(-l / 2, 0, diam / 2 + l2 / 2);
			p2.set( l / 2, 0, diam / 2 + l2 / 2);
			p[0] = p1;  p[1] = p2;
			double tabWidth[2] = { l2, l2 };
			double tabHeight[2] = { l1, l1 };
			bool sides[4] = { true, true, true, true };
			bool con[2] = { false, false };
#ifndef FIX_BRX
			makeBox(1, p, tabWidth, tabHeight, sides, con, true, true);
#else
			bool _sides[4] = { false, false, false, false };
			makeBox(1, p, tabWidth, tabHeight, sides, con, true, false);
			makeBox(1, p, tabWidth, tabHeight, _sides, con, false, true);
#endif
			};  break;

		case 10:  // TCDPV
		case 12:  // TCFV
			{
			double SW = 30, d1 = 60, R = 70, C = 30;
			double D2 = 60, d3 = 20, H = 200, h = 20, d4 = 30;

			get_val("d1", d1);
			get_val("dext", D2);
			get_val("d3", d3);
			get_val("d4", d4);
			get_val("H", H);
			get_val("h", h);
			get_val("R", R);
			get_val("SW", SW);
			get_val("C", C);

			FdPoint3d p1(0, 0, 0), p2, p3, p4;
			double alfa = asin((D2 / 2) * 1 / R);
			alfa = alfa * 180 / ARX_PI;
			double latAngles[2] = { alfa, 180 - alfa };
			double longAngles[2] = { 0, 360 };
			double axisLengths[3] = { 2 * R, 2 * R, 2 * R };
			int n[2] = { cpx, 4 * cpx };
			makeSpheroidSection(p1, vx, vz, latAngles, longAngles, axisLengths, n);

			//
			p1.set(-L / 2 + C, 0, 0);  p2.set(-sqrt(R * R - D2 * D2 / 4), 0, 0);
			FdPoint3d p[3] = { p1, p1, p2 };
			double diamsT[3] = { 0.01, D2, D2 };
			makeUniVectorTube(p, vx, diamsT, cpx, 2);

			//
			p1.set( L / 2 - C, 0, 0);  p2.set(sqrt(R * R - D2 * D2 / 4), 0, 0);
			p[0] = p1; p[1] = p1; p[2] = p2;
			makeUniVectorTube(p,-vx,diamsT,cpx,2);

			//
			FdPoint3d p01(0, 0, sqrt(R * R - d3 * d3 / 4));
			FdPoint3d p02(0, 0, H - 2 * h);
			FdPoint3d p03(0, 0, H - 2 * h);
			FdPoint3d p04(0, 0, H -     h);
			FdPoint3d p05(0, 0, H);
			FdPoint3d p06(0, 0, H);
			FdPoint3d k[6] = { p01, p02, p03, p04, p05, p06 };
			double diams[6] = { d3, d3, d4, d1, d4, 0.01 };
			makeUniVectorTube(k, vz, diams, cpx, 5);

			//
			p1.set(-L / 2 + C, 0, 0);
			makeScrew2(p1, -vx, -vz, SW, C, true, false);

			//
			p2.set( L / 2 - C, 0, 0);
			makeScrew2(p2, vx, vz, SW, C, true, false);
			};  break;

		case 11:  // CCDPV
		case 13:  // CCFV
			{
			// we substract flange from "L"
			L -= 2 * GetFlgThick("L1");

			double d1 = 60, R = 70;
			double D2 = 60, d3 = 20, H = 200, h = 20, d4 = 30;

			get_val("d1", d1);
			get_val("dext", D2);
			get_val("d3", d3);
			get_val("d4", d4);
			get_val("H", H);
			get_val("h", h);
			get_val("R", R);

			FdPoint3d p1(0, 0, 0), p2, p3, p4;
			double alfa = asin((D2 / 2) * 1 / R);
			alfa = alfa * 180 / ARX_PI;
			double latAngles[2] = { alfa, 180 - alfa };
			double longAngles[2] = { 0, 360 };
			double axisLengths[3] = { 2 * R, 2 * R, 2 * R };
			int n[2] = { cpx, 4 * cpx };
			makeSpheroidSection(p1, vx, vz, latAngles, longAngles, axisLengths, n);

			//
			p1.set(-L / 2, 0, 0);  p2.set(-sqrt(R * R - D2 * D2 / 4), 0, 0);
			FdPoint3d p[3] = { p1, p1, p2 };
			double diamsT[3] = { 0.01, D2, D2 };
			makeUniVectorTube(p, vx, diamsT, cpx, 2);

			//
			p1.set(sqrt(R * R - D2 * D2 / 4), 0, 0);  p2.set(L / 2, 0, 0);
			p[0] = p2;  p[1] = p2;  p[2] = p1;
			makeUniVectorTube(p, -vx, diamsT, cpx, 2);

			//
			FdPoint3d p01(0, 0, sqrt(R * R - d3 * d3 / 4));
			FdPoint3d p02(0, 0, H - 2 * h);
			FdPoint3d p03(0, 0, H - 2 * h);
			FdPoint3d p04(0, 0, H -     h);
			FdPoint3d p05(0, 0, H);
			FdPoint3d p06(0, 0, H);
			FdPoint3d k[6] = { p01, p02, p03, p04, p05, p06 };
			double diams[6] = { d3, d3, d4, d1, d4, 0.01 };
			makeUniVectorTube(k, vz, diams, cpx, 5);
			};  break;
		};

	return 0;
	};

short CGeneralBlockCreator :: make3WayValve()
	{
	short elType;
	ads_real ndiam, diam, L;

	get_val("diam", ndiam);
	get_ext_diam("L1", diam);
	get_val("L", L);
	get_val("elType", elType);
	if( diam <= 0 )
		diam = ndiam;

	switch( (int) elType )
		{
		case 0:  // T3WV
			{
			// additional variables
			double l, l1, l2, L1 = 200, C = 5, SW = 15, l3 = 9;

			get_val("dext", diam);
			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("l3", l3);
			get_val("L1", L1);
			get_val("C", C);
			get_val("SW", SW);

			L -= C * 2;
			L1 -= C;

			// make tube
			FdPoint3d p1(-L / 2.0, 0, 0),
			          p2( L / 2.0, 0, 0);
			double tubeData[2] = { diam, L };
			double interTubeData[4] = { diam, L1, L / 2, 0 };
			double angles[2] = { 0, 90 };
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

			// make box
			p1.set(-l / 2, diam / 2 + l2 / 2, 0);
			p2.set( l / 2, diam / 2 + l2 / 2, 0);
			FdPoint3d p[2] = { p1, p2 };
			double tabWidth[2] = { l1, l1 };
			double tabHeight[2] = { l2, l2 };
			bool sides[4] = { true, true, true, true };
			bool con[2] = { false, false };
#ifndef FIX_BRX
			makeBox(1, p, tabWidth, tabHeight, sides, con, true, true);
#else
			bool _sides[4] = { false, false, false, false };
			makeBox(1, p, tabWidth, tabHeight, sides, con, true, false);
			makeBox(1, p, tabWidth, tabHeight, _sides, con, false, true);
#endif

			// making screws
			p1.set(-L / 2 - C, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, true);
			makeScrew2(p1, vx, vz, SW, C, false);

			p1.set( L / 2, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, true);
			makeScrew2(p1, vx, vz, SW, C, false);

			p1.set(0, -L1 - C, 0);
			makeScrew2(p1, vy, vz, SW, C, true);
			makeScrew2(p1, vy, vz, SW, C, false);
			};  break;

		case 1:  // C3WV
			{
			// we substract flange from "L"
			L -= 2 * GetFlgThick("L1");

			// additional variables
			double l, l1, l2, L1;
			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("L1", L1);
			get_val("dext", diam);

			// make tube
			FdPoint3d p1(-L / 2.0, 0, 0),
			          p2( L / 2.0, 0, 0);
			double tubeData[2] = { diam, L };
			double interTubeData[4] = { diam, L1 - GetFlgThick("L1"), L / 2, 0 };
			double angles[2] = { 0, 90 };
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

			// make box
			p1.set(-l / 2, 0, diam / 2 + l2 / 2);
			p2.set( l / 2, 0, diam / 2 + l2 / 2);
			FdPoint3d p[2] = { p1, p2 };
			double tabWidth[2] = { l2, l2 };
			double tabHeight[2] = { l1, l1 };
			bool sides[4] = { true, true, true, true };
			bool con[2] = { false, false };
#ifndef FIX_BRX
			makeBox(1, p, tabWidth, tabHeight, sides, con, true, true);
#else
			bool _sides[4] = { false, false, false, false };
			makeBox(1, p, tabWidth, tabHeight, sides, con, true, false);
			makeBox(1, p, tabWidth, tabHeight, _sides, con, false, true);
#endif
			};  break;
		};

	return 0;
	};

short CGeneralBlockCreator :: makeMEF()
	{
	short elType;
	ads_real L, H, ndiam, diam;

	get_val("L", L);
	get_val("H", H);
	get_val("diam", ndiam);
	get_ext_diam("L1", diam);
	get_val("elType", elType);
	if( diam <= 0 )
		diam = ndiam;

	switch( elType )
		{
		case 0:  // TMEF
			{
			get_val("dext", diam);
			double SW = diam, C = 20;
			get_val("SW", SW);
			get_val("C", C);

			// additional variables
			double alfa = 45, l = L / 2;
			L -= 2 * C;

			double alfa2 = alfa * (ARX_PI / 180);
			double x = (diam / 2) / tan(alfa2);

			FdPoint3d p1(-L / 2, 0, 0);
			double tubeParams[3] = { diam, diam, L };
			double interTubePosition[2] = { L / 2 - x, 0 };
			double interTubeParameters[3] = { l, diam, diam };
			double angles[3] = { 180 - alfa, 90, 90 };
			int n[2] = { cpx, cpx };
			bool opt[3] = { false, false, false };
			makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

			p1.set(-L / 2, 0, 0);
			makeScrew2(p1, -vx, vz, SW, C, true);
			makeScrew2(p1, -vx, vz, SW, C, false);

			p1.set( L / 2, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, true);
			makeScrew2(p1, vx, vz, SW, C, false);

			p1.set(-L / 2, 0, 0);
			FdPoint3d p[2] = { p1, p1 };
			double diams[2] = { diam, 0.01 };
			makeUniVectorTube(p, vx, diams, cpx, 1);

			p1.set( L / 2, 0, 0);
			p[0] = p1;  p[1] = p1;
			makeUniVectorTube(p, vx, diams, cpx, 1);

			double x2 = sin(alfa2) * l;
			double y2 = cos(alfa2) * l;

			p1.set(-x, 0, 0);
			FdPoint3d p3(-x + x2, -y2, 0);
			FdVector3d v(p3 - p1);
			FdPoint3d pn[2] = { p3, p3 };
			double diamsn[2] = { diam, 0 };
			makeUniVectorTube(pn, v, diamsn, cpx, 1);
			};  break;

		case 1:  // CMEF
			{
			double l = L / 2;

			// we substract flange from "L"
			L -= 2 * GetFlgThick("L1");

			double ft, fs, dint;
			get_val("dext", diam);
			get_val("ft", ft);
			get_val("fs", fs);
			get_val("dint", dint);

			// additional variables
			double alfa = 45;
			double alfa2 = alfa * (ARX_PI / 180);
			double x = (diam / 2) / tan(alfa2);
			double x1 = sin(alfa2) * (l - ft);
			double x2 = sin(alfa2) * l;
			double y1 = cos(alfa2) * (l - ft);
			double y2 = cos(alfa2) * l;

			FdPoint3d p1(-L / 2, 0, 0);
			double tubeParams[3] = { diam, diam, L };
			double interTubePosition[2] = { L / 2 - x, 0 };
			double interTubeParameters[3] = { l - ft, diam, diam };
			double angles[3] = { 180 - alfa, 90, 90 };
			int n[2] = { cpx, cpx };
			bool opt[3] = { false, false, false };
			makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

			FdPoint3d p2(-x + x1, -y1, 0),
			          p3(-x + x2, -y2, 0);
			FdVector3d v(p3 - p2);
			FdPoint3d p[4] = { p2, p2, p3, p3 };
			double diams[4] = { diam, fs, fs, dint };
			makeUniVectorTube(p, v, diams, cpx, 3);
			};  break;
		};

	return 0;
	};

short CGeneralBlockCreator :: makeMF()
	{
	ads_real L, H, ndiam1, diam1, diam2, elType;

	get_val("L", L);
	get_val("H", H);
	get_val("diam1", ndiam1);
	get_ext_diam("L1", diam1);

	get_val("diam2", diam2);
	get_val("elType", elType);
	if( diam1 <= 0 )
		diam1 = ndiam1;

	switch( (int) elType )
		{
		case 0:  // TMF
			{
			double diam = diam1;
			double C = 20, SW = diam;

			get_val("dext", diam);
			get_val("SW", SW);
			get_val("C", C);

			L -= 2 * C;

			FdPoint3d p1(0, diam / 2, 0);
			double tubeData[2] = { diam2, H };
			double interTubeData[4] = { diam, L / 2, diam / 2, 0 };
			double angles[2] = { 0, 90 };
			makeTubeToTubeIntersection2(p1, -vy, tubeData, interTubeData, angles, cpx, true);
			angles[1] = 270;
			makeTubeToTubeIntersection2(p1, -vy, tubeData, interTubeData, angles, cpx, true);

			p1.set(0, diam / 2 - H, 0);
			double latAngles[2] = { 0, 90 };
			double longAngles[2] = { 0, 360 };
			double diams[3] = { diam2, diam2, diam2 };
			int n[2] = { cpx, 4 * cpx };
			makeSpheroidSection(p1, vy, latAngles, longAngles, diams, n);

			p1.set(0, diam / 2, 0);
			FdPoint3d p[2] = { p1, p1 };
			diams[0] = diam2;  diams[1] = 0.01;
			makeUniVectorTube(p, vy, diams, cpx, 1);

			p1.set(-L / 2, 0, 0);
			makeScrew2(p1, -vx, vy, SW, C, true);
			makeScrew2(p1, -vx, vy, SW, C, false);
			diams[0] = diam;  diams[1] = 0.01;
			p[0] = p1;  p[1] = p1;
			makeUniVectorTube(p, vx, diams, cpx, 1);

			p1.set( L / 2, 0, 0);
			makeScrew2(p1, vx, vy, SW, C, true);
			makeScrew2(p1, vx, vy, SW, C, false);
			p[0] = p1;  p[1] = p1;
			makeUniVectorTube(p, vx, diams, cpx, 1);
			};  break;

		case 1:  // CMFI
			{
			double diam = diam1;
			get_val("dext", diam);
			L -= 2 * GetFlgThick("L1");

			FdPoint3d p1(0, diam / 2, 0);
			double tubeData[2] = { diam2, H };
			double interTubeData[4] = { diam, L / 2, diam / 2, 0 };
			double angles[2] = { 0, 90 };
			makeTubeToTubeIntersection2(p1, -vy, tubeData, interTubeData, angles, cpx, true);
			angles[1] = 270;
			makeTubeToTubeIntersection2(p1, -vy, tubeData, interTubeData, angles, cpx, true);

			p1.set(0, diam / 2 - H, 0);
			double latAngles[2] = { 0, 90 };
			double longAngles[2] = { 0, 360 };
			double diams[3] = { diam2, diam2, diam2 };
			int n[2] = { cpx, 4 * cpx };
			makeSpheroidSection(p1, vy, latAngles, longAngles, diams, n);

			p1.set(0, diam / 2, 0);
			FdPoint3d p[2] = { p1, p1 };
			diams[0] = diam2;  diams[1] = 0;
			makeUniVectorTube(p, vy, diams, cpx, 1);
			};  break;
		};

	return 0;
	};

short CGeneralBlockCreator :: makeDE()
	{
	ads_real L, H, diam, diam2;

	get_val("L", L);
	get_val("H", H);
	get_val("diam2", diam2);
	get_val("dext", diam);
	L -= 2 * GetFlgThick("L1");

	FdPoint3d p1(0, diam / 2, 0);
	double tubeData[2] = { diam2, H };
	double interTubeData[4] = { diam, L / 2, diam / 2, 0 };
	double angles[2] = { 0, 90 };
	makeTubeToTubeIntersection2(p1, -vy, tubeData, interTubeData, angles, cpx, true);
	angles[1] = 270;
	makeTubeToTubeIntersection2(p1, -vy, tubeData, interTubeData, angles, cpx, true);

	p1.set(0, diam / 2, 0);
	FdPoint3d p[2] = { p1, p1 };
	double diams[2] = { diam2, 0.01 };
	makeUniVectorTube(p, vy, diams, cpx, 1);

	p1.set(0, diam / 2 - H, 0);
	p[0] = p1;  p[1] = p1;
	makeUniVectorTube(p, vy, diams, cpx, 1);

	return 0;
	};

short CGeneralBlockCreator :: makeETV()
	{
	ads_real ndiam, diam, L;

	get_val("diam", ndiam);
	get_ext_diam("L1", diam);
	get_val("L", L);
	if( diam <= 0 )
		diam = ndiam;
	get_val("dext", diam);

	double C = 20, SW = 100, d1 = 1.5 * diam, d2 = 1.25 * diam, l1 = 200, H = 200;

	get_val("C", C);
	get_val("SW", SW);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("l1", l1);
	get_val("H", H);

	FdPoint3d p1(0, -l1 / 2 + C, 0), p2, p3;
	makeScrew2(p1, -vy, vz, SW, C, true);
	makeScrew2(p1, -vy, vz, SW, C, false);

	double tubeParameters[2] = { diam, l1 - 2 * C };
	double interTubeData[4] = { diam, L - C, (l1 - 2 * C) / 2, 0 };
	double angles[2] = { 0, 90 };
	makeTubeToTubeIntersection2(p1, vy, tubeParameters, interTubeData, angles, cpx, false);

	p1.set(L, 0, 0);
	makeScrew2(p1, -vx, vz, SW, C, true);
	makeScrew2(p1, -vx, vz, SW, C, false);

	p1.set(0, l1 / 2 - C, 0);
	p2.set(0, l1 / 2,     0);
	p3.set(0, H,          0);
	FdPoint3d p[6] = { p1, p1, p2, p2, p3, p3 };
	double diams[6] = { diam, d2, d2, d1, d1, 0.01 };
	makeUniVectorTube(p, vy, diams, cpx, 5);

	p1.set(0, -l1 / 2 + C, 0);
	p[0] = p1;  p[1] = p1;
	diams[0] = diam;  diams[1] = 0.01;
	makeUniVectorTube(p, vy, diams, cpx, 1);

	p1.set(L - C, 0, 0);
	p[0] = p1;  p[1] = p1;
	makeUniVectorTube(p, vx, diams, cpx, 1);

	return 0;
	};

short CGeneralBlockCreator :: makeFCON()
	{
	ads_real L, diam, thick = 0, size = 0;
	ads_real dx, dy;

	get_val("L", L);
	get_val("dext", diam);

	thick = GetFlgThick("L1");
	size = GetFlgSize("L1");
	L -= 2 * thick;

	dx = L / 8;
	dy = (diam - size) / 4;

	FdPoint3d p1(-L / 2,          0, 0),
	          p2(-L / 2 +     dx, 0, 0),
	          p3(-L / 2 + 2 * dx, 0, 0),
	          p4(-L / 2 + 3 * dx, 0, 0),
	          p5(-L / 2 + 4 * dx, 0, 0),
	          p6(-L / 2 + 5 * dx, 0, 0),
	          p7(-L / 2 + 6 * dx, 0, 0),
	          p8(-L / 2 + 7 * dx, 0, 0),
	          p9( L / 2,          0, 0);
	FdPoint3d p[9] = { p1, p2, p3, p4, p5, p6, p7, p8, p9 };
	double diams[9]	= { diam, diam - dy, diam + dy, diam - dy, diam + dy, diam - dy, diam + dy, diam - dy, diam };
	makeUniVectorTube(p, vx, diams, cpx, 8);

	return 0;
	};

short CGeneralBlockCreator :: makeMA()
	{
	ads_real diam, L;
	get_val("dext", diam);
	double r = 1.5 * diam, d1 = diam;

	L = 1.5 * diam;
	get_val("r", r);
	get_val("L", L);

	FdPoint3d p1(-d1 / 2, 0, 0),
	          p2( d1 / 2, 0, 0);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	double diams[4] = { 0, r, r, 0 };
	makeUniVectorTube(p, vx, diams, cpx, 3);

	return 0;
	};

short CGeneralBlockCreator :: makeSTV()
	{
	ads_real diam, L;
	get_val("L", L);
	get_val("dext", diam);

	// additional variables
	double C = 20, SW = diam, d1 = 2 * diam, d2 = 1.2 * diam, h1 = diam, h2 = C, H = 300;

	get_val("C", C);
	get_val("SW", SW);
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("h1", h1);
	get_val("h2", h2);
	get_val("H", H);

	L -= 2 * C;

	FdPoint3d p1(-L / 2, 0, 0), p2, p3;
	double tubeData[2] = { diam, L };
	double interTubeData[4] = { diam, h1, L / 2, 0 };
	double angles[2] = { 0, 270 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	makeScrew2(p1, -vx, vz, SW, C, true);
	makeScrew2(p1, -vx, vz, SW, C, false);

	p1.set( L / 2, 0, 0);
	makeScrew2(p1, vx, vz, SW, C, true);
	makeScrew2(p1, vx, vz, SW, C, false);

	p1.set(0, h1,      0);
	p2.set(0, h1 + h2, 0);
	p3.set(0, H,       0);
	FdPoint3d p[6] = { p1, p1, p2, p2, p3, p3 };
	double diams[6] = { diam, d2, d2, d1, d1, 0.01 };
	makeUniVectorTube(p, vy, diams, cpx, 5);

	// closing main tube
	p1.set(-L / 2, 0, 0);
	p[0] = p1;  p[1] = p1;
	diams[1] = 0.01;
	makeUniVectorTube(p, vx, diams, cpx, 1);

	p1.set( L / 2, 0, 0);
	p[0] = p1;  p[1] = p1;
	makeUniVectorTube(p, vx, diams, cpx, 1);

	return 0;
	};

short CGeneralBlockCreator :: makeMA2()
	{
	ads_real diam;
	get_val("dext", diam);

	FdPoint3d p1(0, -2 * diam, 0),
	          p2(0,  2 * diam, 0);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	double diams[4] = { 0.01, 1.5 * diam, 1.5 * diam, 0.01 };
	makeUniVectorTube(p, vy, diams, cpx, 3);

	return 0;
	};

short CGeneralBlockCreator :: makeSV()
	{
	short elType = 0;
	ads_real ndiam1, diam1, ndiam2, diam2;

	get_val("diam1", ndiam1);
	get_ext_diam("L1", diam1);
	get_val("diam2", ndiam2);
	get_ext_diam("L2", diam2);
	get_val("elType", elType);
	if( diam1 <= 0 )
		diam1 = ndiam1;
	if( diam2 <= 0 )
		diam2 = ndiam2;

	switch( (int) elType )
		{
		case 0:  // CSV
			{
			double l = 50, l1 = 25, l2 = 10, l3 = 30, l4 = 20, d = 25, L = 200, ft, fs;

			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("l3", l3);
			get_val("l4", l4);
			get_val("d", d);
			get_val("L", L);
			get_val("ft", ft);
			get_val("fs", fs);
			get_val("dext", diam1);

			double thick = ft, size = fs;

			FdPoint3d p1(0, -L / 2 + ft, 0), p2, p3;
			double tubeData[2] = { diam1, L - 2 * ft };
			double interTubeData[4] = { diam1, L / 2, (L - 2 * ft) / 2, 0 };
			double angles[2] = { 0, 270 };
			makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, cpx, false);

			p1.set(0, L / 2 - ft, 0);
			p2.set(0, L / 2,      0);
			p3.set(0, L / 2 + l3, 0);
			FdPoint3d p[6] = { p1, p1, p2, p2, p3, p3 };
			double diams[6] = { diam1, size, size, d, d, 0.01 };
			makeUniVectorTube(p, vy, diams, cpx, 5);

			p1.set(0,          L / 2 + l3 + l2 / 2,      0);
			p2.set(l - l2 / 2, L / 2 + l3 + l2 / 2,      0);
			p3.set(l - l2 / 2, L / 2 + l3 + l2 / 2 - l1, 0);

			p[0] = p1;  p[1] = p2;  p[2] = p3;
			FdVector3d v1(0.5, -0.5, 0);
			FdVector3d v[3] = { vx, v1, -vy };
			FdVector3d upv[3] = { vz, vz, vz };
			double width[3] = { l2, sqrt(2.0) * l2, l2 };
			double height[3] = { l4, l4, l4 };
			bool sides[8] = { true, true, true, true,
			                  true, true, true, true };

			makeBox(2, p, v, upv, width, height, sides, true, true, 5, 5, 20);
			};  break;

		case 1:  // TSV
			{
			double SW = diam1, C = 20, d1 = diam1 * 1.45, d2 = diam1 * 1.25, d3 = diam1 / 2, l = 60, d = 1.5 * diam1, l1 = diam1, l2 = diam1 / 4, L = 200;

			get_val("SW", SW);
			get_val("C", C);
			get_val("d", d);
			get_val("d1", d1);
			get_val("d2", d2);
			get_val("d3", d3);
			get_val("l", l);
			get_val("l1", l1);
			get_val("l2", l2);
			get_val("L", L);
			get_val("dext", diam1);

			FdPoint3d p1(0, -L / 2,           0),
			          p2(0, -L / 2 + C,       0),
			          p3(0,  L / 2 - l1 / 2,  0),
			          p4(0,  L / 2,           0),
			          p5(0,  L / 2 + l2,      0),
			          p6(0,  L / 2 + l2 + l1, 0);
			makeScrew2(p1, vy, vx, SW, C, true);

			FdPoint3d p[10] = { p2, p2, p3, p3, p4, p4, p5, p5, p6, p6 };
			double diams[10] = { 0.01, diam1, diam1, d2, d2, d3, d3, d1, d1, 0.01 };
			makeUniVectorTube(p, vy, diams, cpx, 9);

			p1.set(-diam1 / 2,     0, 0);
			p2.set(-diam1 / 2 - l, 0, 0);
			p[0] = p1;  p[1] = p1;  p[2] = p2;  p[3] = p2;
			diams[0] = 0.01;  diams[1] = d;  diams[2] = d;  diams[3] = 0.01;
			makeUniVectorTube(p, -vx, diams, cpx, 3);
			};  break;
		};

	return 0;
	};

short CGeneralBlockCreator :: makeCFSMA()
	{
	ads_real SW, C, l, tl1, tl2, elType3d = 0, dm1, dm2;

	get_val("dm1", dm1);
	get_val("dm2", dm2);
	get_val("SW", SW);
	get_val("C", C);
	get_val("L", l);
	get_val("tl1", tl1);  // tl1 zamiast tl2
	get_val("tl2", tl2);
	get_val("elType3d", elType3d);

	double extDiam = SW / cos(ARX_PI / 6);
	FdPoint3d lp1(-l / 2, 0, 0),
	          lp2( l / 2, 0, 0);
	addCenterLine(lp1, lp2);

	switch( (int) elType3d )
		{
		case 0:  // CFSMA
			{
			if( extDiam >= dm1 )
				{
				FdPoint3d p1(l / 2 - C, 0, 0);
				makeScrew(p1, vx, vy, SW, C, true, true);
				}
			else
				{
				FdPoint3d p1(l / 2 - C, 0, 0);
				makeScrew(p1, vx, vy, SW, C, false, true);

				FdPoint3d p[2] = { p1, p1 };
				double diams[2] = { 0, dm1 };
				makeUniVectorTube(p, vx, diams, cpx, 1);
				};
			};  break;

		case 1:  // CFSFA
			{
			FdPoint3d p(-l / 2, 0, 0);
			makeScrew(p, vx, vy, SW, C, true, extDiam < dm1 ? false : true);

			// connector cpx
			if( l > C + tl2 )
				{
				FdPoint3d p1(-l / 2 + C,   0, 0),
				          p2( l / 2 - tl2, 0, 0);
				FdPoint3d p[2] = { p1, p2 };
				double diams[2] = { dm1, dm2 };
				makeUniVectorTube(p, vx, diams, concpx, 1);

				if( extDiam < dm1 )
					{
					p[0] = p[1] = p1;
					diams[0] = 0;  diams[1] = dm1;
					makeUniVectorTube(p, vx, diams, concpx, 1);
					};
				}
			else
				{
				FdPoint3d p1(-l / 2 + C, 0, 0);
				FdPoint3d p[2] = { p1, p1 };
				double diams[2] = { 0, dm2 };
				makeUniVectorTube(p, vx, diams, concpx, 1);
				};
			};  break;

		case 2:  // PFSMA
			{
			FdPoint3d p1(l / 2 - tl2, 0, 0);
			FdPoint3d p[2] = { p1, p1 };
			double diams[2] = { dm1, dm2 };
			makeUniVectorTube(p, vx, diams, concpx, 1);
			};  break;

		default:
		case 3:  // PFSFA
			{
			FdPoint3d p1(-l / 2 + tl1, 0, 0),
			          p2( l / 2 - tl2, 0, 0);
			FdPoint3d p[2] = { p1, p2 };
			double diams[2] = { dm1, dm2 };
			makeUniVectorTube(p, vx, diams, concpx, 1);
			};  break;
		};

	return 0;
	};

short CGeneralBlockCreator :: makeDV()
	{
	ads_real l, l1, d;

	get_val("d", d);
	get_val("L", l);
	get_val("l1", l1);

	FdPoint3d p1(l1, 0, 0),
	          p2(l1 + l, 0, 0);
	FdPoint3d p[2] = { p1, p2 };
	double tabWidth[2]  = { d, d };
	double tabHeight[2] = { d, d };
	bool con[2] = { false, false };
	bool sides[4] = { true, true, true, true };
#ifndef FIX_BRX
	makeBox(1, p, tabWidth, tabHeight, sides, con, true, true);
#else
	bool _sides[4] = { false, false, false, false };
	makeBox(1, p, tabWidth, tabHeight, sides, con, true, false);
	makeBox(1, p, tabWidth, tabHeight, _sides, con, false, true);
#endif

	FdPoint3d lp1(0, 0, 0), lp2(p2);
	addCenterLine(lp1, lp2);

	return 0;
	};

short CGeneralBlockCreator :: makeFITA()
	{
	ads_real l;
	get_val("ft", l);

	// make center line
	FdPoint3d lp1(-l / 2, 0, 0),
	          lp2( l / 2, 0, 0);
	addCenterLine(lp1, lp2);

	return 0;
	};

short CGeneralBlockCreator :: makeFPA()
	{
	ads_real l;
	get_val("L", l);

	// make center line
	FdPoint3d lp1(-l / 2, 0, 0),
	          lp2( l / 2, 0, 0);
	addCenterLine(lp1, lp2);

	return 0;
	};

short CGeneralBlockCreator :: makeFWP()
	{
	ads_real d1, d2, l;

	get_val("dm2", d2);
	get_val("d1", d1);
	get_val("L", l);

	// make center line
	FdPoint3d lp1(-l / 2, 0, 0),
	          lp2( l / 2, 0, 0);
	addCenterLine(lp1, lp2);

	return 0;
	};

short CGeneralBlockCreator :: makePSITEA()
	{
	ads_real d1, dm1, d2, dm2, dmm2, l1, tl2, ang, r;

	get_val("d1", d1);
	get_val("dm1", dm1);
	get_val("dm2", d2);
	get_val("dm2", dm2);
	get_val("dmm2", dmm2);
	get_val("angle", ang);
	get_val("radius", r);
	get_val("l1", l1);
	get_val("tl2", tl2);

	double alfa = ang;
	ang = ang * ARX_PI / 180;

	FdPoint3d p1(0, -r * tan(ang / 2.0) - l1, 0),
	          p2(0, -r * tan(ang / 2.0),      0),
	          pc(r, -r * tan(ang / 2.0),      0);
	FdPoint3d p[4] = { p1, p1, p2 };
	double diams[4] = { 0.01, dm1, dm1 };
	makeUniVectorTube(p, vy, diams, cpx, 2);

	addCircularConnector(p1, vy, dm1 / 2);

	makeDonutSection(pc, -vz, -vx, r, dm1, alfa, cpx, cpx);

	p1.set((r * tan(ang / 2.0)) * sin(ang) - dm2 / 2.0 * cos(ang), (r * tan(ang / 2.0)) * cos(ang) /* + dm2 / 2.0 * sin(ang) + 0.5 * tl2 * cos(ang) */, 0);
	p2.set((r * tan(ang / 2.0)) * sin(ang) - dm2 / 2.0 * cos(ang) + tl2 * sin(ang), (r * tan(ang / 2.0)) * cos(ang) /* + dm2 / 2.0 * sin(ang) + 0.5 * tl2 * cos(ang) */, 0);

	p[0] = p1;  p[1] = p1;  p[2] = p2;  p[3] = p2;
	diams[0] = dm1;  diams[1] = dm2;  diams[2] = dm2;  diams[3] = 0;
	FdVector3d v = p2 - p1;  v.normalize();
	makeUniVectorTube(p, v, diams, cpx, 3);

	addCircularConnector(p2, v, dm2 / 2);

	return 0;
	};

short CGeneralBlockCreator :: makeSWTA()
	{
	ads_real l, tl1, tl2, dm1, dm2;

	get_val("dm1", dm1);
	get_val("dm2", dm2);
	get_val("L", l);
	get_val("tl1", tl1);  // tl1 zamiast tl2
	get_val("tl2", tl2);

	FdPoint3d p1(-l / 2 + tl1, 0, 0),
	          p2( l / 2 - tl2, 0, 0);
	FdPoint3d p[2] = { p1, p2 };
	double diams[2] = { dm1, dm2 };
	makeUniVectorTube(p, vx, diams, concpx, 1);

	// make center line
	FdPoint3d lp1(-l / 2, 0, 0),
	          lp2( l / 2, 0, 0);
	addCenterLine(lp1, lp2);

	return 0;
	};

short CGeneralBlockCreator :: makeTFMN()
	{
	ads_real elType3d = 0, L;

	get_val("L", L);
	get_val("elType3d", elType3d);
	FdPoint3d lp1(-L / 2, 0, 0),
	          lp2( L / 2, 0, 0);
	addCenterLine(lp1, lp2);

	switch( (int) elType3d )
		{
		case 0:  // TFMN
			{
			double SW, SW1, C, C1;
			get_val("SW", SW);
			get_val("SW1", SW1);
			get_val("C", C);
			get_val("C1", C1);

			FdPoint3d p1(-L / 2, 0, 0);
			makeScrew2(p1, vx, vz, SW1, C1, true, SW1 > SW ? true : false);

			p1.set(-L / 2 + C1, 0, 0);
			makeScrew2(p1, vx, vz, SW, C, SW > SW1 ? true : false, true);
			};  break;

		case 1:  // TFMN
			{
			double SW, SW1, SW2, C1, C2;
			get_val("SW", SW);
			get_val("SW1", SW1);
			get_val("SW2", SW2);
			get_val("C1", C1);
			get_val("C2", C2);

			FdPoint3d p1(-L / 2, 0, 0);
			makeScrew2(p1, vx, vz, SW1, C1, true, SW1 > SW ? true : false);

			p1.set(-L / 2 + C1, 0, 0);
			makeScrew2(p1, vx, vz, SW, L - (C1 + C2), SW > SW1 ? true : false, SW > SW2 ? true : false);

			p1.set( L / 2 - C2, 0, 0);
			makeScrew2(p1, vx, vz, SW2, C2, SW2 > SW ? true : false, true);
			};  break;
		};

	return 0;
	};

short CGeneralBlockCreator :: makeTFMT()
	{
	ads_real L;
	double SW, C;

	get_val("L", L);
	get_val("SW", SW);
	get_val("C", C);

	FdPoint3d lp1(-L / 2, 0, 0),
	          lp2( L / 2, 0, 0);
	addCenterLine(lp1, lp2);

	FdPoint3d p1(-L / 2, 0, 0);
	makeScrew2(p1, vx, vz, SW, C, true);

	return 0;
	};

short CGeneralBlockCreator :: makeUNION()
	{
	ads_real l, tl1, tl2, dm1, dm2;

	get_val("dm1", dm1);
	get_val("dm2", dm2);
	get_val("L", l);
	get_val("l1", tl1);
	get_val("l2", tl2);

	FdPoint3d p1(-l / 2 + tl1, 0, 0),
	          p2( l / 2 - tl2, 0, 0);
	FdPoint3d p[2] = { p1, p2 };
	double diams[2] = { dm1, dm2 };
	makeUniVectorTube(p, vx, diams, concpx, 1);

	FdPoint3d lp1(-l / 2, 0, 0),
	          lp2( l / 2, 0, 0);
	addCenterLine(lp1, lp2);

	return 0;
	};

short CGeneralBlockCreator :: makeWNIT()
	{
	double L, SW, C;
	get_val("L", L);
	get_val("SW", SW);
	get_val("C", C);

	FdPoint3d lp1(-L / 2, 0, 0),
	          lp2( L / 2, 0, 0);
	addCenterLine(lp1, lp2);

	FdPoint3d p1(L / 2, 0, 0);
	makeScrew2(p1, -vx, vz, SW, C, true);

	return 0;
	};

short CGeneralBlockCreator :: makeWTIT()
	{
	ads_real L;
	get_val("L", L);

	double SW, SW1, C, C1;
	get_val("SW", SW);
	get_val("SW1", SW1);
	get_val("C", C);
	get_val("C1", C1);

	FdPoint3d p1(L / 2, 0, 0);
	makeScrew2(p1, -vx, vz, SW1, C1, true, SW1 > SW ? true : false);

	p1.set(L / 2 - C1, 0, 0);
	makeScrew2(p1, -vx, vz, SW, C, SW > SW1 ? true : false, true);

	return 0;
	};

short CGeneralBlockCreator :: makePTHR()
	{
	double L = 100, d = 20, dint;
	get_val("l", L);
	get_val("dext", d);
	get_val("dint", dint);

	FdPoint3d p1(-L / 2, 0, 0),
	          p2( L / 2, 0, 0);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	double diams[4] = { dint, d, d, dint };
	makeUniVectorTube(p, vx, diams, cpx, 3);

	p[0] = p1;  p[1] = p2;
	makeSimpleTube(p, dint, dint, cpx);

	addCenterLine(p1, p2);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		dint = d;
		d += 2 * size;

		FdPoint3d p1(-L / 2, 0, 0),
		          p2( L / 2, 0, 0);
		FdPoint3d p[4] = { p1, p1, p2, p2 };
		double diams[4] = { dint, d, d, dint };
		makeUniVectorTube(p, vx, diams, cpx, 3);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeFMRTHR()
	{
	double L = 100, d1 = 50, d2 = 20, d1int = 40, d2int = 10, tl = 10;

	get_val("l", L);
	get_val("d1ext", d1);
	get_val("d2ext", d2);
	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("tl", tl);

	FdPoint3d p1(-L / 2,      0, 0),
	          p2(-L / 2 + tl, 0, 0),
	          p3( L / 2,      0, 0);
	FdPoint3d p[5] = { p1, p1, p2, p3, p3 };
	double diams[5] = { d1int, d1, d1, d2, d2int };
	makeUniVectorTube(p, vx, diams, cpx, 4);

	p[0] = p1;  p[1] = p2;  p[2] = p3;
	diams[0] = d1int;  diams[1] = d1int;  diams[2] = d2int;
	makeUniVectorTube(p, vx, diams, cpx, 2);

	addCenterLine(p1, p3);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		d1int = d1;  d2int = d2;
		d1 += 2 * size;  d2 += 2 * size;

		FdPoint3d p1(-L / 2,      0, 0),
		          p2(-L / 2 + tl, 0, 0),
		          p3( L / 2,      0, 0);
		FdPoint3d p[5] = { p1, p1, p2, p3, p3 };
		double diams[5] = { d1int, d1, d1, d2, d2int };
		makeUniVectorTube(p, vx, diams, cpx, 4);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeETHR()
	{
	double l1 = 50, l2 = 50, r = 300, alfa = 90, df = 50, dm = 40, dint = 30, tl = 30;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("r", r);
	get_val("alfa", alfa);
	get_val("df", df);
	get_val("dext", dm);
	get_val("dint", dint);
	get_val("tl", tl);

	double y1 = (dm - dint) / 2 * tan(ARX_PI / 4);  // in
	double y2 = (df - dm)   / 2 * tan(ARX_PI / 4);  // out
	double beta = (alfa / 2) * (ARX_PI / 180);
	double mcd = r - r * tan(beta);

	if( tl + y1 > l1 )  tl = l1 - y1;
	if( tl + y2 > l1 )  tl = l1 - y2;
	if( tl + y1 > l2 )  tl = l2 - y1;
	if( tl + y2 > l2 )  tl = l2 - y2;

	FdPoint3d p1   (0, -l1 - r           + mcd, 0),
	          p2   (0, -l1 - r + tl      + mcd, 0);
	FdPoint3d p3in (0, -l1 - r + tl + y1 + mcd, 0),
	          p3out(0, -l1 - r + tl + y2 + mcd, 0);
	FdPoint3d p4   (0,     - r           + mcd, 0);

	double alfa2 = alfa * (ARX_PI / 180);
	double xx = cos(alfa2) * r;
	double yy = sin(alfa2) * r;
	FdPoint3d pn(p4.x + r - xx, p4.y + yy, p4.z);
	FdVector3d v(vy);
	v.rotateBy(alfa2, -vz);
	FdVector3d v1(v.normalize());

	FdPoint3d p5(pn);
	FdPoint3d p6in(pn);
	v = v1;  v *= l2 - tl - y1;  p6in += v;
	FdPoint3d p6out(pn);
	v = v1;  v *= l2 - tl - y2;  p6out += v;
	FdPoint3d p7(pn);
	v = v1;  v *= l2 - tl;  p7 += v;
	FdPoint3d p8(pn);
	v = v1;  v *= l2;  p8 += v;

	// in bottom
	FdPoint3d p[4] = { p1, p2, p3in, p4 };
	double diams[4] = { dm, dm, dint, dint };
	makeUniVectorTube(p, vy, diams, cpx, 3);

	// out bottom
	FdPoint3d pp[5] = { p1, p1, p2, p3out, p4 };
	double diams2[5] = { dm, df, df, dm, dm };
	makeUniVectorTube(pp, vy, diams2, cpx, 4);

	addCenterLine(p1, p4);

	// in bend
	FdPoint3d pc(p4);  pc.x += r;
	makeDonutSection(pc, -vz, -vx, r, dint, alfa, cpx, cpx);

	addCenterArc(pc, -vz, -vx, r, 0, alfa2);

	// out bend
	makeDonutSection(pc, -vz, -vx, r, dm, alfa, cpx, cpx);

	// in top
	FdPoint3d ppp[4] = { p8, p7, p6in, p5 };
	double diams3[4] = { dm, dm, dint, dint };
	makeUniVectorTube(ppp, -v1, diams3, cpx, 3);

	// out top
	FdPoint3d pppp[5] = { p8, p8, p7, p6out, p5 };
	double diams4[5] = { dm, df, df, dm, dm };
	makeUniVectorTube(pppp, -v1, diams4, cpx, 4);

	addCenterLine(p8, p5);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		// calc differences;
		double d2 = df-dm;
		dint = dm;
		dm = df;
		df += 2 * size;
		double dmIns = df - d2;

		double y2 = (df - dmIns) / 2 * tan(ARX_PI / 4);  // out
		double beta = (alfa / 2) * (ARX_PI / 180);
		double mcd = r - r * tan(beta);

		if( tl + y2 > l1 )  tl = l1 - y2;
		if( tl + y2 > l2 )  tl = l2 - y2;

		FdPoint3d p1   (0, -l1 - r           + mcd, 0),
		          p2   (0, -l1 - r + tl      + mcd, 0);
		FdPoint3d p3in (0, -l1 - r + tl + y1 + mcd, 0),
		          p3out(0, -l1 - r + tl + y2 + mcd, 0);
		FdPoint3d p4   (0,     - r           + mcd, 0);

		double alfa2 = alfa * (ARX_PI / 180);
		double xx = cos(alfa2) * r;
		double yy = sin(alfa2) * r;
		FdPoint3d pn(p4.x + r - xx, p4.y + yy, p4.z);
		FdVector3d v(vy);
		v.rotateBy(alfa2, -vz);
		FdVector3d v1(v.normalize());

		FdPoint3d p5(pn);
		FdPoint3d p6in(pn);
		v = v1;  v *= l2 - tl - y1;  p6in += v;
		FdPoint3d p6out(pn);
		v = v1;  v *= l2 - tl - y2;  p6out += v;
		FdPoint3d p7(pn);
		v = v1;  v *= l2 - tl;  p7 += v;
		FdPoint3d p8(pn);
		v = v1;  v *= l2;  p8 += v;

		// out bottom
		FdPoint3d pp[5] = { p1, p1, p4 };
		double diams2[5] = { dm, df, df };
		makeUniVectorTube(pp, vy, diams2, cpx, 2);

		// out bend
		makeDonutSection(pc, -vz, -vx, r, df, alfa, cpx, cpx);

		// out top
		FdPoint3d pppp[5] = { p8, p8, p5 };
		double diams4[5] = { dm, df, df };
		makeUniVectorTube(pppp, -v1, diams4, cpx, 2);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeSTTHR()
	{
	double l1 = 200, l2 = 200, l3 = 200;
	double d = 50, tl = 20, alfa = 90, dint = 30;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("dext", d);
	get_val("tl", tl);
	get_val("alfa", alfa);
	get_val("dint", dint);

	alfa = 90 - alfa;

	// out
	FdPoint3d p1(-l1, 0, 0),
	          p2( l2, 0, 0);
	double tubeData[2] = { d, l1 + l2 };
	double interTubeData[4] = { d, l3, l1, 0 };
	double angles[2] = { alfa, 270 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	// in
	tubeData[0] = dint;
	interTubeData[0] = dint;  // interTubeData[1] = l3;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	addCenterLine(p1, p2);

	// caps...
	// left
	FdPoint3d p[2] = { p1, p1 };
	double diams[2] = { dint, d };
	makeUniVectorTube(p, vx, diams, cpx, 1);
	// right
	p[0] = p2;  p[1] = p2;
	makeUniVectorTube(p, vx, diams, cpx, 1);

	// intersecting tube
	alfa = alfa * (ARX_PI / 180);
	double x = sin(alfa) * l3;
	double y = cos(alfa) * l3;
	FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);
	FdVector3d v(pc - c);
	p[0] = p[1] = pc;
	makeUniVectorTube(p, v, diams, cpx, 1);

	addCenterLine(c, pc);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		get_val("alfa", alfa);
		alfa = 90 - alfa;

		dint = d;
		d += 2 * size;

		// out
		FdPoint3d p1(-l1, 0, 0),
		          p2( l2, 0, 0);
		double tubeData[2] = { d, l1 + l2 };
		double interTubeData[4] = { d, l3, l1, 0 };
		double angles[2] = { alfa, 270 };
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

		// caps...
		// left
		FdPoint3d p[2] = { p1, p1 };
		double diams[2] = { dint, d };
		makeUniVectorTube(p, vx, diams, cpx, 1);
		// right
		p[0] = p2;  p[1] = p2;
		makeUniVectorTube(p, vx, diams, cpx, 1);

		// intersecting tube
		alfa = alfa * (ARX_PI / 180);
		double x = sin(alfa) * l3;
		double y = cos(alfa) * l3;
		FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);
		FdVector3d v(pc - c);
		p[0] = p[1] = pc;
		makeUniVectorTube(p, v, diams, cpx, 1);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeCRTHR()
	{
	double d1 = 50, d2 = 40, d3 = 40, d4 = 30;
	double d1int = 40, d2int = 30, d3int = 30, d4int = 20;
	double alfa = 75, beta = 45;
	double l1 = 200, l2 = 200, l3 = 100, l4 = 100, l5 = 20;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("l4", l4);
	get_val("l5", l5);
	get_val("d1ext", d1);
	get_val("d2ext", d2);
	get_val("d3ext", d3);
	get_val("d4ext", d4);
	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("d3int", d3int);
	get_val("d4int", d4int);
	get_val("alfa", alfa);
	get_val("beta", beta);

	alfa = 90 - alfa;
	beta = 90 - beta;

	// alfa out
	FdPoint3d p1(-l1,      0, 0),
	          p2( l2 - l5, 0, 0),
	          p3( l2,      0, 0);
	double tubeData[2] = { d1, l1 + l2 - l5 };
	double interTubeData[4] = { d3, l3, l1, 0 };
	double angles[2] = { alfa, 270 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

	// beta out
	angles[0] = beta;  angles[1] = 90;
	interTubeData[0] = d4;  interTubeData[1] = l4;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

	// alfa in
	tubeData[0] = d1int;
	angles[0] = alfa;  angles[1] = 270;
	interTubeData[0] = d3int;  interTubeData[1] = l3;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

	// beta in
	angles[0] = beta;  angles[1] = 90;
	interTubeData[0] = d4int;  interTubeData[1] = l4;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

	addCenterLine(p1, p3);

	// caps...
	// left
	FdPoint3d p[2] = { p1, p1 };
	double diams[2] = { d1int, d1 };
	makeUniVectorTube(p, vx, diams, cpx, 1);
	// right
	p[0] = p3;  p[1] = p3;
	diams[0] = d2int;  diams[1] = d2;
	makeUniVectorTube(p, vx, diams, cpx, 1);

	// intersecting tube alfa
	alfa = alfa * (ARX_PI / 180);
	double x = sin(alfa) * l3;
	double y = cos(alfa) * l3;
	FdPoint3d c(0, 0, 0), pc(x, y, 0);
	FdVector3d v(pc - c);
	v.normalize();
	p[0] = p[1] = pc;
	diams[0] = d3int;  diams[1] = d3;
	makeUniVectorTube(p, v, diams, cpx, 1);

	addCenterLine(c, pc);

	// intersecting tube beta
	beta = beta * (ARX_PI / 180);
	x = sin(beta) * l4;
	y = cos(beta) * l4;
	pc.set(x, -y, 0);
	v = pc - c;
	v.normalize();
	p[0] = p[1] = pc;
	diams[0] = d4int;  diams[1] = d4;
	makeUniVectorTube(p, v, diams, cpx, 1);

	addCenterLine(c, pc);

	if( l5 != 0 )
		{
		// end tube out
		p[0] = p2;  p[1] = p3;
		makeSimpleTube(p, d1, d2, cpx);

		// end tube in
		makeSimpleTube(p, d1int, d2int, cpx);
		};

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		get_val("alfa", alfa);
		get_val("beta", beta);

		alfa = 90 - alfa;  beta = 90 - beta;
		d1int = d1;  d2int = d2;  d3int = d3;  d4int = d4;
		d1 += 2 * size;  d2 += 2 * size;  d3 += 2 * size;  d4 += 2 * size;

		// alfa out
		FdPoint3d p1(-l1,      0, 0),
		          p2( l2 - l5, 0, 0),
		          p3( l2,      0, 0);
		double tubeData[2] = { d1, l1 + l2 - l5 };
		double interTubeData[4] = { d3, l3, l1, 0 };
		double angles[2] = { alfa, 270 };
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

		// beta out
		angles[0] = beta;  angles[1] = 90;
		interTubeData[0] = d4;  interTubeData[1] = l4;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

		// caps...
		// left
		FdPoint3d p[2] = { p1, p1 };
		double diams[2] = { d1int, d1 };
		makeUniVectorTube(p, vx, diams, cpx, 1);
		// right
		p[0] = p3;  p[1] = p3;
		diams[0] = d2int;  diams[1] = d2;
		makeUniVectorTube(p, vx, diams, cpx, 1);

		// intersecting tube alfa
		alfa = alfa * (ARX_PI / 180);
		double x = sin(alfa) * l3;
		double y = cos(alfa) * l3;
		FdPoint3d c(0, 0, 0), pc(x, y, 0);
		FdVector3d v(pc - c);
		v.normalize();
		p[0] = p[1] = pc;
		diams[0] = d3int;  diams[1] = d3;
		makeUniVectorTube(p, v, diams, cpx, 1);

		// intersecting tube beta
		beta = beta * (ARX_PI / 180);
		x = sin(beta) * l4;
		y = cos(beta) * l4;
		pc.set(x, -y, 0);
		v = pc - c;
		v.normalize();
		p[0] = p[1] = pc;
		diams[0] = d4int;  diams[1] = d4;
		makeUniVectorTube(p, v, diams, cpx, 1);

		if( l5 != 0 )
			{
			// end tube out
			p[0] = p2;  p[1] = p3;
			makeSimpleTube(p, d1, d2, cpx);

			// end tube in
			makeSimpleTube(p, d1int, d2int, cpx);
			};
		};

	return 0;
	};

short CGeneralBlockCreator :: makeRTTHR()
	{
	double d1 = 50, d2 = 40, d3 = 40;
	double d1int = 40, d2int = 30, d3int = 30;
	double l1 = 100, l2 = 100, l3 = 100, l4 = 20;
	double alfa = 75;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("l4", l4);
	get_val("d1ext", d1);
	get_val("d2ext", d2);
	get_val("d3ext", d3);
	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("d3int", d3int);
	get_val("alfa", alfa);

	alfa = 90 - alfa;

	// out
	FdPoint3d p1(-l1,      0, 0),
	          p2( l2 - l4, 0, 0),
	          p3( l2,      0, 0);
	double tubeData[2] = { d1, l1 + l2 - l4 };
	double interTubeData[4] = { d3, l3, l1, 0 };
	double angles[2] = { alfa, 270 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	// in
	tubeData[0] = d1int;
	interTubeData[0] = d3int;  // interTubeData[1] = l3;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	addCenterLine(p1, p3);

	// caps...
	// left
	FdPoint3d p[2] = { p1, p1 };
	double diams[2] = { d1int, d1 };
	makeUniVectorTube(p, vx, diams, cpx, 1);
	// right
	p[0] = p3;  p[1] = p3;
	diams[0] = d2int;  diams[1] = d2;
	makeUniVectorTube(p, vx, diams, cpx, 1);

	// intersecting tube
	alfa = alfa * (ARX_PI / 180);
	double x = sin(alfa) * l3;
	double y = cos(alfa) * l3;
	FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);
	FdVector3d v(pc - c);
	v.normalize();
	p[0] = p[1] = pc;
	diams[0] = d3int;  diams[1] = d3;
	makeUniVectorTube(p, v, diams, cpx, 1);

	addCenterLine(c, pc);

	if( l4 != 0 )
		{
		// end tube out
		p[0] = p2;  p[1] = p3;
		makeSimpleTube(p, d1, d2, cpx);

		// end tube in
		makeSimpleTube(p, d1int, d2int, cpx);
		};

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		get_val("alfa", alfa);
		alfa = 90 - alfa;

		d1int = d1;  d2int = d2;  d3int = d3;
		d1 += 2 * size;  d2 += 2 * size;  d3 += 2 * size;

		// out
		FdPoint3d p1(-l1,      0, 0),
		          p2( l2 - l4, 0, 0),
		          p3( l2,      0, 0);
		double tubeData[2] = { d1, l1 + l2 - l4 };
		double interTubeData[4] = { d3, l3, l1, 0 };
		double angles[2] = { alfa, 270 };
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

		// caps...
		// left
		FdPoint3d p[2] = { p1, p1 };
		double diams[2] = { d1int, d1 };
		makeUniVectorTube(p, vx, diams, cpx, 1);
		// right
		p[0] = p3;  p[1] = p3;
		diams[0] = d2int;  diams[1] = d2;
		makeUniVectorTube(p, vx, diams, cpx, 1);

		// intersecting tube
		alfa = alfa * (ARX_PI / 180);
		double x = sin(alfa) * l3;
		double y = cos(alfa) * l3;
		FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);
		FdVector3d v(pc - c);
		v.normalize();
		p[0] = p[1] = pc;
		diams[0] = d3int;  diams[1] = d3;
		makeUniVectorTube(p, v, diams, cpx, 1);

		if( l4 != 0 )
			{
			// end tube out
			p[0] = p2;  p[1] = p3;
			makeSimpleTube(p, d1, d2, cpx);

			// end tube in
			makeSimpleTube(p, d1int, d2int, cpx);
			};
		};

	return 0;
	};

short CGeneralBlockCreator :: makeYTHR()
	{
	double R = 50, d1ext = 50, d1int = 40, d2ext = 50, d2int = 40, d3ext = 50, d3int = 40;
	double  l1 = 120, l2 = 120, l3 = 120, alfa = 60;

	get_val("R", R);
	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("d3int", d3int);
	get_val("d1ext", d1ext);
	get_val("d2ext", d2ext);
	get_val("d3ext", d3ext);
	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("alfa", alfa);

	// Sanity checks for R - so that 2 * R >= dext + 20%.
	// Setting R equal to or less than dext / 2.0 causes
	// the geometry to be invalid or even freeze AutoCAD.
	if( R < 0.6 * d1ext )  R = 0.6 * d1ext;
	if( R < 0.6 * d2ext )  R = 0.6 * d2ext;
	if( R < 0.6 * d3ext )  R = 0.6 * d3ext;

	alfa = alfa * ARX_PI / 180;
	FdPoint3d pc(0, 0, 0), p1(0, 0, 0), p2(0, 0, 0);
	FdPoint3d p[2] = { p1, p2 };
	double latAngles[2] = { 0, 180 };
	double longAngles[2] = { 0, 360 };
	double tab1[3] = { 2 * R, 2 * R, 2 * R};
	int n[2] = { cpx, 4 * cpx };
	makeSpheroidSection(p2, vx, vy, latAngles, longAngles, tab1, n);

	double x;
	FdVector3d v;
	FdPoint3d k[3];
	double diam[3];
	x = sqrt(R * R - 0.25 * d1ext * d1ext);
	if( x < l1 )
		{
		v.set( sqrt(R * R - 0.25 * d1ext * d1ext) * cos(alfa / 2),
		       sqrt(R * R - 0.25 * d1ext * d1ext) * sin(alfa / 2), 0);
		v.normalize();

		p1 = pc + v * x;
		p2 = pc + v * l1;
		p[0] = p1;  p[1] = p2;
		k[0] = p1;  k[1] = p2;  k[2] = p2;
		diam[0] = d1ext;  diam[1] = d1ext;  diam[2] = d1int;

		makeUniVectorTube(k, v, diam, cpx, 2);
		makeSimpleTube(p, d1int, d1int, cpx);
		addCenterLine(pc, p2);
		};

	x = sqrt(R * R - 0.25 * d2ext * d2ext);
	if( x < l2 )
		{
		v.set( sqrt(R * R - 0.25 * d2ext * d2ext) * cos(alfa / 2),
		      -sqrt(R * R - 0.25 * d2ext * d2ext) * sin(alfa / 2), 0);
		v.normalize();

		p1 = pc + v * x;
		p2 = pc + v * l2;
		p[0] = p1;  p[1] = p2;
		k[0] = p1;  k[1] = p2;  k[2] = p2;
		diam[0] = d2ext;  diam[1] = d2ext;  diam[2] = d2int;

		makeUniVectorTube(k, v, diam, cpx, 2);
		makeSimpleTube(p, d2int, d2int, cpx);
		addCenterLine(pc, p2);
		};

	x = sqrt(R * R - 0.25 * d3ext * d3ext);
	if( x < l3 )
		{
		v.set(-sqrt(R * R - 0.25 * d3ext * d3ext) * cos(alfa / 2), 0, 0);
		v.normalize();

		p1 = pc + v * x;
		p2 = pc + v * l3;
		p[0] = p1;  p[1] = p2;
		k[0] = p1;  k[1] = p2;  k[2] = p2;
		diam[0] = d3ext;  diam[1] = d3ext;  diam[2] = d3int;

		makeUniVectorTube(k, v, diam, cpx, 2);
		makeSimpleTube(p, d3int, d3int, cpx);
		addCenterLine(pc, p2);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeCOTHR()
	{
	double R = 30;
	double d1ext = 50, d1int = 30, d2ext = 40;
	double d2int = 10, d3ext = 60, d3int = 50;
	double l1 = 120, l2 = 150, l3 = 200;

	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("d3int", d3int);
	get_val("d1ext", d1ext);
	get_val("d2ext", d2ext);
	get_val("d3ext", d3ext);
	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);

	R = max(max(d1ext, d2ext), d3ext);
	R = R / 2.0;

	FdPoint3d p1(1, 0, 0), p2(0, 0, 0), p0(0, 0, 0);
	FdPoint3d p[2] = { p1, p2 };
	double latAngles[2] = { 0, 180 };
	double longAngles[2] = { 0, 360 };
	double tab1[3] = { 2 * R, 2 * R, 2 * R };
	int n[2] = { cpx, 4 * cpx };
	makeSpheroidSection(p2, vx, vy, latAngles, longAngles, tab1, n);

	//
	p1.set(sqrt(R * R - d1ext * d1ext * 0.25), 0, 0);
	p2.set(l1, 0,  0);
	p[0] = p1;  p[1] = p2;
	FdPoint3d p3(l1, 0, 0);
	FdPoint3d k[3] = { p1, p2, p3 };
	double diam[3] = { d1ext, d1ext, d1int };
	makeUniVectorTube(k, vx, diam, cpx, 2);
	makeSimpleTube(p, d1int, d1int, cpx);

	addCenterLine(p0, p2);

	//
	p1.set(0, 0, sqrt(R * R - d2ext * d2ext * 0.25));
	p2.set(0, 0, l2);
	k[0] = p1;  k[1] = p2;  k[2] = p2;
	diam[0] = d2ext;  diam[1] = d2ext;  diam[2] = d2int;
	makeUniVectorTube(k, vz, diam, cpx, 2);
	p[0] = p1;  p[1] = p2;
	makeSimpleTube(p, d2int, d2int, cpx);

	addCenterLine(p0, p2);

	//
	p1.set(0, sqrt(R * R - d3ext * d3ext * 0.25), 0);
	p2.set(0, l3, 0);
	k[0] = p1;  k[1] = p2;  k[2] = p2;
	diam[0] = d3ext;  diam[1] = d3ext;  diam[2] = d3int;
	makeUniVectorTube(k, vy, diam, cpx, 2);
	p[0] = p1;  p[1] = p2;
	makeSimpleTube(p, d3int, d3int, cpx);

	addCenterLine(p0, p2);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		d1int = d1ext;
		d2int = d2ext;
		d3int = d3ext;
		d1ext += 2 * size;
		d2ext += 2 * size;
		d3ext += 2 * size;
		R += size;

		FdPoint3d p1(1, 0, 0), p2(0, 0, 0), p0(0, 0, 0);
		FdPoint3d p[2] = { p1, p2 };
		double latAngles[2] = { 0, 180 };
		double longAngles[2] = { 0, 360 };
		double tab1[3] = { 2 * R, 2 * R, 2 * R };
		int n[2] = { cpx, 4 * cpx };
		makeSpheroidSection(p2, vx, vy, latAngles, longAngles, tab1, n);

		//
		p1.set(sqrt(R * R - d1ext * d1ext * 0.25), 0, 0);
		p2.set(l1, 0,  0);
		p[0] = p1;  p[1] = p2;
		FdPoint3d p3(l1, 0, 0);
		FdPoint3d k[3] = { p1, p2, p3 };
		double diam[3] = { d1ext, d1ext, d1int };
		makeUniVectorTube(k, vx, diam, cpx, 2);
		makeSimpleTube(p, d1int, d1int, cpx);

		//
		p1.set(0, 0, sqrt(R * R - d2ext * d2ext * 0.25));
		p2.set(0, 0, l2);
		k[0] = p1;  k[1] = p2;  k[2] = p2;
		diam[0] = d2ext;  diam[1] = d2ext;  diam[2] = d2int;
		makeUniVectorTube(k, vz, diam, cpx, 2);
		p[0] = p1;  p[1] = p2;
		makeSimpleTube(p, d2int, d2int, cpx);

		//
		p1.set(0, sqrt(R * R - d3ext * d3ext * 0.25), 0);
		p2.set(0, l3, 0);
		k[0] = p1;  k[1] = p2;  k[2] = p2;
		diam[0] = d3ext;  diam[1] = d3ext;  diam[2] = d3int;
		makeUniVectorTube(k, vy, diam, cpx, 2);
		p[0] = p1;  p[1] = p2;
		makeSimpleTube(p, d3int, d3int, cpx);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeFMETHR()
	{
	double l1 = 50, l2 = 50, r = 300, alfa = 90, df = 50, dm = 40, dint = 30, tl = 30;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("r", r);
	get_val("alfa", alfa);
	get_val("df", df);
	get_val("dext", dm);
	get_val("dint", dint);
	get_val("tl", tl);

	double y1 = (dm - dint) / 2 * tan(ARX_PI / 4);  // in
	double y2 = (df - dm)   / 2 * tan(ARX_PI / 4);  // out
	double beta = (alfa / 2) * (ARX_PI / 180);
	double mcd = r - r * tan(beta);

	if( tl + y1 > l1 )  tl = l1 - y1;
	if( tl + y2 > l1 )  tl = l1 - y2;

	FdPoint3d p1   (0, -l1 - r           + mcd, 0),
	          p2   (0, -l1 - r + tl      + mcd, 0);
	FdPoint3d p3in (0, -l1 - r + tl + y1 + mcd, 0),
	          p3out(0, -l1 - r + tl + y2 + mcd, 0);
	FdPoint3d p4   (0,     - r           + mcd, 0);

	addCenterLine(p1, p4);

	double alfa2 = alfa * (ARX_PI / 180);
	double xx = cos(alfa2) * r;
	double yy = sin(alfa2) * r;
	FdPoint3d pn(p4.x + r - xx, p4.y + yy, p4.z);
	FdVector3d v(vy);
	v.rotateBy(alfa2, -vz);
	FdVector3d v1(v.normalize());

	FdPoint3d p5(pn);
	FdPoint3d p6in(pn);
	v = v1;  v *= l2 - tl - y1;  p6in += v;
	FdPoint3d p6out(pn);
	v = v1;  v *= l2 - tl - y2;  p6out += v;
	FdPoint3d p7(pn);
	v = v1;  v *= l2 - tl;  p7 += v;
	FdPoint3d p8(pn);
	v = v1;  v *= l2;  p8 += v;

	// in bottom
	FdPoint3d p[4] = { p1, p2, p3in, p4 };
	double diams[4] = { dm, dm, dint, dint };
	makeUniVectorTube(p, vy, diams, cpx, 3);

	// out bottom
	FdPoint3d pp[5] = { p1, p1, p2, p3out, p4 };
	double diams2[5] = { dm, df, df, dm, dm };
	makeUniVectorTube(pp, vy, diams2, cpx, 4);

	// in bend
	FdPoint3d pc(p4);  pc.x += r;
	makeDonutSection(pc, -vz, -vx, r, dint, alfa, cpx, cpx);

	addCenterArc(pc, -vz, -vx, r, 0, alfa2);

	// out bend
	makeDonutSection(pc, -vz, -vx, r, dm, alfa, cpx, cpx);

	// in top
	FdPoint3d ppp[4] = { p8, p5 };
	double diams3[4] = { dint, dint };
	makeUniVectorTube(ppp, -v1, diams3, cpx, 1);

	addCenterLine(p8, p5);

	// out top
	FdPoint3d pppp[5] = { p8, p8, p5 };
	double diams4[5] = { dint, dm, dm };
	makeUniVectorTube(pppp, -v1, diams4, cpx, 2);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		// calc differences;
		double d2 = df - dm;
		dint = dm;
		dm = df;
		df += 2 * size;
		double dmIns = df - d2;

		double y2 = (df - dmIns) / 2 * tan(ARX_PI / 4);  // out
		double beta = (alfa / 2) * (ARX_PI / 180);
		double mcd = r - r * tan(beta);

		if( tl + y2 > l1 )  tl = l1 - y2;

		FdPoint3d p1   (0, -l1 - r           + mcd, 0),
		          p2   (0, -l1 - r + tl      + mcd, 0);
		FdPoint3d p3in (0, -l1 - r + tl + y1 + mcd, 0),
		          p3out(0, -l1 - r + tl + y2 + mcd, 0);
		FdPoint3d p4   (0,     - r           + mcd, 0);

		double alfa2 = alfa * (ARX_PI / 180);
		double xx = cos(alfa2) * r;
		double yy = sin(alfa2) * r;
		FdPoint3d pn(p4.x + r - xx, p4.y + yy, p4.z);
		FdVector3d v(vy);
		v.rotateBy(alfa2, -vz);
		FdVector3d v1(v.normalize());

		FdPoint3d p5(pn);
		FdPoint3d p6in(pn);
		v = v1;  v *= l2 - tl - y1;  p6in += v;
		FdPoint3d p6out(pn);
		v = v1;  v *= l2 - tl - y2;  p6out += v;
		FdPoint3d p7(pn);
		v = v1;  v *= l2 - tl;  p7 += v;
		FdPoint3d p8(pn);
		v = v1;  v *= l2;  p8 += v;

		// out bottom
		FdPoint3d pp[5] = { p1, p1, p4 };
		double diams2[5] = { dm, df, df };
		makeUniVectorTube(pp, vy, diams2, cpx, 2);

		// out bend
		makeDonutSection(pc, -vz, -vx, r, df, alfa, cpx, cpx);

		// out top
		FdPoint3d pppp[5] = { p8, p8, p5 };
		double diams4[5] = { dint, df, df };
		makeUniVectorTube(pppp, -v1, diams4, cpx, 2);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeFRTHR()
	{
	double L = 100, d1 = 50, d2 = 20, d1int = 40, d2int = 10, tl = 10;

	get_val("l", L);
	get_val("d1ext", d1);
	get_val("d2ext", d2);
	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("tl", tl);

	if( 2 * tl > L )  tl = L / 2;

	FdPoint3d p1(-L / 2,      0, 0),
	          p2(-L / 2 + tl, 0, 0),
	          p3( L / 2 - tl, 0, 0),
	          p4( L / 2,      0, 0);
	FdPoint3d p[6] = { p1, p1, p2, p3, p4, p4 };
	double diams[6] = { d1int, d1, d1, d2, d2, d2int };
	makeUniVectorTube(p, vx, diams, cpx, 5);

	p[0] = p1;  p[1] = p2;  p[2] = p3;  p[3] = p4;
	diams[0] = d1int;  diams[1] = d1int;  diams[2] = d2int;  diams[3] = d2int;
	makeUniVectorTube(p, vx, diams, cpx, 3);

	addCenterLine(p1, p4);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		d1int = d1;
		d2int = d2;
		d1 += 2 * size;
		d2 += 2 * size;

		FdPoint3d p1(-L / 2,      0, 0),
		          p2(-L / 2 + tl, 0, 0),
		          p3( L / 2 - tl, 0, 0),
		          p4( L / 2,      0, 0);
		FdPoint3d p[6] = { p1, p1, p2, p3, p4, p4 };
		double diams[6] = { d1int, d1, d1, d2, d2, d2int };
		makeUniVectorTube(p, vx, diams, cpx, 5);

		p[0] = p1;  p[1] = p2;  p[2] = p3;  p[3] = p4;
		diams[0] = d1int;  diams[1] = d1int;  diams[2] = d2int;  diams[3] = d2int;
		makeUniVectorTube(p, vx, diams, cpx, 3);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeMFRTHR()
	{
	double l = 100, d1ext = 50, d2int = 40;

	get_val("l", l);
	get_val("d1ext", d1ext);
	get_val("d2int", d2int);

	FdPoint3d p1(-l / 2, 0, 0),
	          p2( l / 2, 0, 0);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	double diams[4] = { d2int, d1ext, d1ext, d2int };
	makeUniVectorTube(p, vx, diams, cpx, 3);

	p[0] = p1;  p[1] = p2;
	makeSimpleTube(p, d2int, d2int, cpx);

	addCenterLine(p1, p2);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		d2int = d1ext;
		d1ext += 2 * size;

		FdPoint3d p1(-l / 2, 0, 0),
		          p2( l / 2, 0, 0);
		FdPoint3d p[4] = { p1, p1, p2, p2 };
		double diams[4] = { d2int, d1ext, d1ext, d2int };
		makeUniVectorTube(p, vx, diams, cpx, 3);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeMRTHR()
	{
	double l = 100, d1ext = 50, d2ext = 20, d1int = 40, d2int = 10;

	get_val("l", l);
	get_val("d1ext", d1ext);
	get_val("d2ext", d2ext);
	get_val("d1int", d1int);
	get_val("d2int", d2int);

	FdPoint3d p1(-l / 2, 0, 0),
	          p2( l / 2, 0, 0);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	double diams[4] = { d1int, d1ext, d2ext, d2int };
	makeUniVectorTube(p, vx, diams, cpx, 3);

	p[1] = p2;
	makeSimpleTube(p, d1int, d2int, cpx);

	addCenterLine(p1, p2);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		d1int = d1ext;
		d2int = d2ext;
		d1ext += 2 * size;
		d2ext += 2 * size;

		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		FdPoint3d p1(-l / 2, 0, 0),
		          p2( l / 2, 0, 0);
		FdPoint3d p[4] = { p1, p1, p2, p2 };
		double diams[4] = { d1int, d1ext, d2ext, d2int };
		makeUniVectorTube(p, vx, diams, cpx, 3);
		};

	return 0;
	};

// Flanged
short CGeneralBlockCreator :: makeCRFLN()
	{
	double d1 = 50, d2 = 40, d3 = 40, d4 = 30;
	double d1int = 40, d2int = 30, d3int = 30, d4int = 20;
	double alfa = 75, beta = 45;
	double l1 = 200, l2 = 200, l3 = 100, l4 = 100, l5 = 20;
	double ft = 10;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("l4", l4);
	get_val("l5", l5);
	get_val("d1ext", d1);
	get_val("d2ext", d2);
	get_val("d3ext", d3);
	get_val("d4ext", d4);
	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("d3int", d3int);
	get_val("d4int", d4int);
	get_val("alfa", alfa);
	get_val("beta", beta);
	ft = GetFlgSize("Left");

	// adjust to automatically drawn flange
	l1 -= ft;
	l2 -= ft;
	l3 -= GetFlgSize("Up");
	l4 -= GetFlgSize("Down");

	double x = 0;
	if( l5 > ft )
		x = l5 - ft;

	alfa = 90 - alfa;
	beta = 90 - beta;

	// alfa out
	FdPoint3d p0(-l1 - ft, 0, 0);
	FdPoint3d p1(-l1,      0, 0),
	          p2( l2 - x,  0, 0),
	          p3( l2,      0, 0);
	double tubeData[2] = { d1, l1 + l2 - x };
	double interTubeData[4] = { d3, l3, l1, 0 };
	double angles[2] = { alfa, 270 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

	addCenterLine(p1, p3);

	// beta out
	angles[0] = beta;  angles[1] = 90;
	interTubeData[0] = d4;  interTubeData[1] = l4;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

	// alfa in
	tubeData[0] = d1int;
	interTubeData[2] = l1 + ft;
	angles[0] = alfa;  angles[1] = 270;
	if( x == 0 )  tubeData[1] = l1 + l2 + ft + ft;
	interTubeData[0] = d3int;  interTubeData[1] = l3 + GetFlgSize("Up");
	makeTubeToTubeIntersection2(p0, vx, tubeData, interTubeData, angles, cpx, true);

	alfa = alfa * (ARX_PI / 180);
	double xm = sin(alfa) * l3;
	double ym = cos(alfa) * l3;
	FdPoint3d c(0, 0, 0), pc(xm, ym, 0);

	addCenterLine(c, pc);

	// beta in
	angles[0] = beta;  angles[1] = 90;
	if( x == 0 )  tubeData[1] = l1 + l2 + ft + ft;
	interTubeData[0] = d4int;  interTubeData[1] = l4 + GetFlgSize("Down");
	makeTubeToTubeIntersection2(p0, vx, tubeData, interTubeData, angles, cpx, true);

	beta = beta * (ARX_PI / 180);
	xm = sin(beta) * l4;
	ym = cos(beta) * l4;
	pc.set(xm, -ym, 0);
	addCenterLine(c, pc);

	FdPoint3d p[4];
	if( p2.x != p3.x )
		{
		// end tube out
		p[0] = p2;  p[1] = p3;
		makeSimpleTube(p, d1, d2, cpx);

		// end tube in
		makeSimpleTube(p, d1int, d2int, cpx);

		FdPoint3d p4(l2 + ft, 0, 0);
		p[0] = p3;  p[1] = p4;
		makeSimpleTube(p, d2int, d2int, cpx);
		};

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		get_val("alfa", alfa);
		get_val("beta", beta);

		alfa = 90 - alfa;
		beta = 90 - beta;

		d1int = d1;  d2int = d2;  d3int = d3;  d4int = d4;
		d1 += 2 * size;  d2 += 2 * size;  d3 += 2 * size;  d4 += 2 * size;

		// alfa out
		FdPoint3d p0(-l1 - ft, 0, 0);
		FdPoint3d p1(-l1,      0, 0),
		          p2( l2 - x,  0, 0),
		          p3( l2,      0, 0);
		double tubeData[2] = { d1, l1 + l2 - x };
		double interTubeData[4] = { d3, l3, l1, 0 };
		double angles[2] = { alfa, 270 };
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

		// beta out
		angles[0] = beta;  angles[1] = 90;
		interTubeData[0] = d4;  interTubeData[1] = l4;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

		alfa = alfa * (ARX_PI / 180);
		double xm = sin(alfa) * l3;
		double ym = cos(alfa) * l3;
		FdPoint3d c(0, 0, 0), pc(xm, ym, 0);

		beta = beta * (ARX_PI / 180);
		xm = sin(beta) * l4;
		ym = cos(beta) * l4;
		pc.set(xm, -ym, 0);
		addCenterLine(c, pc);

		FdPoint3d p[4];
		if( p2.x != p3.x )
			{
			// end tube out
			p[0] = p2;  p[1] = p3;
			makeSimpleTube(p, d1, d2, cpx);

			FdPoint3d p4(l2 + ft, 0, 0);
			p[0] = p3;  p[1] = p4;
			makeSimpleTube(p, d2int, d2int, cpx);
			};
		};

	return 0;
	};

short CGeneralBlockCreator :: makeEFLN()
	{
	double l1 = 50, l2 = 50, r = 300, alfa = 90;
	double df = 50, dm = 40, dint = 30, tl = 0;
	double ft = 10;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("r", r);
	get_val("alfa", alfa);
	get_val("dext", dm);
	get_val("dint", dint);
	ft = GetFlgSize("Down");

	df = dm;
	// l1 -= ft;
	// l2 -= ft;

	double beta = (alfa / 2) * (ARX_PI / 180);
	double mcd = r - r * tan(beta);

	FdPoint3d p0(0, - r + mcd, 0);
	FdPoint3d p1(p0), p4(p0);

	double alfa2 = alfa * (ARX_PI / 180);
	double xx = cos(alfa2) * r;
	double yy = sin(alfa2) * r;
	FdPoint3d pn(r - xx, p0.y + yy, 0);
	FdVector3d v(vy);
	v.rotateBy(alfa2, -vz);
	FdVector3d copyv(v);
	v.normalize();
	v *= l2;

	FdPoint3d p5(pn);
	FdPoint3d p8(p5);
	p8 += v;

	v = vy;
	v.rotateBy(alfa2, -vz);
	v.normalize();
	v *= l2 - ft;
	FdPoint3d p9(p5);
	p9 += v;

	FdPoint3d pc(p4);
	p4.y -= l1 - ft;

	// in bottom
	FdPoint3d p[2] = { p0, p4 };
	double diams[2] = { dint, dint };
	makeUniVectorTube(p, vy, diams, cpx, 1);

	addCenterLine(p0, p4);

	// out bottom
	FdPoint3d pp[2] = { p1, p4 };
	double diams2[2] = { dm, dm };
	makeUniVectorTube(pp, vy, diams2, cpx, 1);

	// in bend
	pc.x += r;
	makeDonutSection(pc, -vz, -vx, r, dint, alfa, cpx, cpx);

	addCenterArc(pc, -vz, -vx, r, 0, alfa2);

	// out bend
	makeDonutSection(pc, -vz, -vx, r, dm, alfa, cpx, cpx);

	// in top
	FdPoint3d ppp[2] = { p9, p5 };
	double diams3[2] = { dint, dint };
	makeUniVectorTube(ppp, -copyv, diams3, cpx, 1);

	addCenterLine(p9, p5);

	// out top
	FdPoint3d pppp[2] = { p8, p5 };
	double diams4[2] = { dm, dm };
	makeUniVectorTube(pppp, -copyv, diams4, cpx, 1);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		dint = dm;
		dm += 2 * size;

		double y1 = 0;
		double y2 = 0;
		double beta = (alfa / 2) * (ARX_PI / 180);
		double mcd = r - r * tan(beta);

		FdPoint3d p0   (0, -l1 - ft - r           + mcd, 0),
		          p1   (0, -l1      - r           + mcd, 0),
		          p2   (0, -l1      - r + tl      + mcd, 0);
		FdPoint3d p3in (0, -l1      - r + tl + y1 + mcd, 0),
		          p3out(0, -l1      - r + tl + y2 + mcd, 0);
		FdPoint3d p4   (0,          - r           + mcd, 0);

		double alfa2 = alfa * (ARX_PI / 180);
		double xx = cos(alfa2) * r;
		double yy = sin(alfa2) * r;
		FdPoint3d pn(p4.x + r - xx, p4.y + yy, p4.z);
		FdVector3d v(vy);
		v.rotateBy(alfa2, -vz);
		FdVector3d copyv(v);
		v.normalize();
		v *= l2;

		FdPoint3d p5(pn);
		FdPoint3d p8(p5);
		p8+=v;

		v = vy;
		v.rotateBy(alfa2, -vz);
		v.normalize();
		v *= l2 + ft;
		FdPoint3d p9(p5);
		p9 += v;

		// out bottom
		FdPoint3d pp[2] = { p1, p4 };
		double diams2[2] = { dm, dm };
		makeUniVectorTube(pp, vy, diams2, cpx, 1);

		// out bend
		makeDonutSection(pc, -vz, -vx, r, dm, alfa, cpx, cpx);

		// out top
		FdPoint3d pppp[2] = { p8, p5 };
		double diams4[2] = { dm, dm };
		makeUniVectorTube(pppp, -copyv, diams4, cpx, 1);
		};

	return 0;
	};

short CGeneralBlockCreator :: makePFLN()
	{
	double L = 100, d = 20, dint = 10, ft = 10;

	get_val("l", L);
	get_val("dext", d);
	get_val("dint", dint);
	ft = GetFlgSize("Left");

	L -= 2 * ft;

	FdPoint3d p1(-L / 2, 0, 0),
	          p2( L / 2, 0, 0);
	FdPoint3d p[2] = { p1, p2 };
	double diams[2] = { d, d };
	makeUniVectorTube(p, vx, diams, cpx, 1);

	addCenterLine(p1, p2);

	p1.set(-L / 2 - ft, 0, 0);
	p2.set( L / 2 + ft, 0, 0);
	p[0] = p1;  p[1] = p2;
	makeSimpleTube(p, dint, dint, cpx);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		dint = d;
		d += 2 * size;

		FdPoint3d p1(-L / 2, 0, 0),
		          p2( L / 2, 0, 0);
		FdPoint3d p[2] = { p1, p2 };
		double diams[2] = { d, d };
		makeUniVectorTube(p, vx, diams, cpx, 1);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeRFLN()
	{
	double l = 100, d1int = 40, d1ext = 50, d2int = 30, d2ext = 40;
	double ft = 10;

	get_val("l", l);
	get_val("d1ext", d1ext);
	get_val("d2ext", d2ext);
	get_val("d1int", d1int);
	get_val("d2int", d2int);

	FdPoint3d p1(-l / 2 + GetFlgSize("Left"),  0, 0),
	          p2( l / 2 - GetFlgSize("Right"), 0, 0);
	FdPoint3d p[2] = { p1, p2 };
	double diams[2] = { d1ext, d2ext };
	makeUniVectorTube(p, vx, diams, cpx, 1);

	FdPoint3d p3(-l / 2, 0, 0),
	          p4( l / 2, 0, 0);
	p[0] = p3;  p[1] = p4;
	makeSimpleTube(p, d1int, d2int, cpx);

	addCenterLine(p3, p4);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		d1ext += 2 * size; d2ext += 2 * size;

		FdPoint3d p1(-l / 2 + GetFlgSize("Left"),  0, 0),
		          p2( l / 2 - GetFlgSize("Right"), 0, 0);
		FdPoint3d p[2] = { p1, p2 };
		double diams[2] = { d1ext, d2ext };
		makeUniVectorTube(p, vx, diams, cpx, 1);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeRTFLN()
	{
	double d1 = 50, d2 = 40, d3 = 40;
	double d1int = 40, d2int = 30, d3int = 30;
	double l1 = 100, l2 = 100, l3 = 100, l4 = 20;
	double alfa = 75, ft =10;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("l4", l4);
	get_val("d1ext", d1);
	get_val("d2ext", d2);
	get_val("d3ext", d3);
	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("d3int", d3int);
	get_val("alfa", alfa);
	ft = GetFlgSize("Left");

	l1 -= ft;
	l2 -= ft;
	l3 -= GetFlgSize("Up");

	double x = 0;
	if( l4 > ft )
		x = l4 - ft;
	alfa = 90 - alfa;

	// out
	FdPoint3d p1(-l1,     0, 0),
	          p2( l2 - x, 0, 0),
	          p3( l2,     0, 0);
	double tubeData[2] = { d1, l1 + l2 - x };
	double interTubeData[4] = { d3, l3, l1, 0 };
	double angles[2] = { alfa, 270 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	// in
	tubeData[0] = d1int;
	interTubeData[0] = d3int;
	if( x == 0 )
		{ tubeData[1] = l1 + l2 + 2 * ft;  p1.x -= ft; };
	interTubeData[1] = l3 + GetFlgSize("Up");
	interTubeData[2] = l1 + ft;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	addCenterLine(p1, p3);

	alfa = alfa * (ARX_PI / 180);
	FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);

	addCenterLine(c, pc);

	FdPoint3d p[2];
	if( p2.x != p3.x )
		{
		// end tube out
		p[0] = p2;  p[1] = p3;
		makeSimpleTube(p, d1, d2, cpx);

		// end tube in
		makeSimpleTube(p, d1int, d2int, cpx);

		FdPoint3d p4(l2 + ft, 0, 0);
		p[0] = p3;  p[1] = p4;
		makeSimpleTube(p, d2int, d2int, cpx);
		};

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		get_val("alfa", alfa);

		d1int = d1;
		d2int = d2;
		d3int = d3;

		d1 += 2 * size;
		d2 += 2 * size;
		d3 += 2 * size;

		double x = 0;
		if( l4 > ft )
			x = l4 - ft;
		alfa = 90 - alfa;

		// out
		FdPoint3d p1(-l1,     0, 0),
		          p2( l2 - x, 0, 0),
		          p3( l2,     0, 0);
		double tubeData[2] = { d1, l1 + l2 - x };
		double interTubeData[4] = { d3, l3, l1, 0 };
		double angles[2] = { alfa, 270 };
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

		alfa = alfa * (ARX_PI / 180);
		FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);

		FdPoint3d p[2];
		if( p2.x != p3.x )
			{
			// end tube out
			p[0] = p2;  p[1] = p3;
			makeSimpleTube(p, d1, d2, cpx);

			FdPoint3d p4(l2 + ft, 0, 0);
			p[0] = p3;  p[1] = p4;
			makeSimpleTube(p, d2int, d2int, cpx);
			};
		};

	return 0;
	};

short CGeneralBlockCreator :: makeSTFLN()
	{
	double l1 = 200, l2 = 200, l3 = 200;
	double d = 50, tl = 20, alfa = 90, dint = 30;
	double ft = 10;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("dext", d);
	get_val("tl", tl);
	get_val("alfa", alfa);
	get_val("dint", dint);
	ft = GetFlgSize("Left");

	l1 -= ft;
	l2 -= ft;
	l3 -= GetFlgSize("Up");
	alfa = 90 - alfa;

	// out
	FdPoint3d p1(-l1, 0, 0),
	          p2( l2, 0, 0);
	double tubeData[2] = { d, l1 + l2 };
	double interTubeData[4] = { d, l3, l1, 0 };
	double angles[2] = { alfa, 270 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	// in
	tubeData[0] = dint;
	interTubeData[0] = dint;
	FdPoint3d p3(-l1 - ft, 0, 0);
	tubeData[1] = l1 + l2 + 2 * ft;
	interTubeData[1] = l3 + GetFlgSize("Up");
	interTubeData[2] = l1 + ft;
	makeTubeToTubeIntersection2(p3, vx, tubeData, interTubeData, angles, cpx, false);

	addCenterLine(p1, p2);

	alfa = alfa * (ARX_PI / 180);
	FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);

	addCenterLine(c, pc);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		get_val("alfa", alfa);
		alfa = 90 - alfa;

		dint = d;
		d += 2*size;

		// out
		FdPoint3d p1(-l1, 0, 0),
		          p2( l2, 0, 0);
		double tubeData[2] = { d, l1 + l2 };
		double interTubeData[4] = { d, l3, l1, 0 };
		double angles[2] = { alfa, 270 };
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeCRWLD()
	{
	double d1 = 50, d2 = 40, d3 = 40, d4 = 30;
	double d1int = 40, d2int = 30, d3int = 30, d4int = 20;
	double alfa = 75, beta = 45;
	double l1 = 200, l2 = 200, l3 = 100, l4 = 100, l5 = 20;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("l4", l4);
	get_val("l5", l5);
	get_val("d1ext", d1);
	get_val("d2ext", d2);
	get_val("d3ext", d3);
	get_val("d4ext", d4);
	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("d3int", d3int);
	get_val("d4int", d4int);
	get_val("alfa", alfa);
	get_val("beta", beta);

	alfa = 90 - alfa;
	beta = 90 - beta;

	// alfa out
	FdPoint3d p1(-l1,      0, 0),
	          p2( l2 - l5, 0, 0),
	          p3( l2,      0, 0);
	double tubeData[2] = { d1, l1 + l2 - l5 };
	double interTubeData[4] = { d3, l3, l1, 0 };
	double angles[2] = { alfa, 270 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

	addCenterLine(p1, p3);

	// beta out
	angles[0] = beta;  angles[1] = 90;
	interTubeData[0] = d4;  interTubeData[1] = l4;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

	// alfa in
	tubeData[0] = d1int;
	angles[0] = alfa;  angles[1] = 270;
	interTubeData[0] = d3int;  interTubeData[1] = l3;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

	// beta in
	angles[0] = beta;  angles[1] = 90;
	interTubeData[0] = d4int;  interTubeData[1] = l4;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

	// caps...
	// left
	FdPoint3d p[2] = { p1, p1 };
	double diams[2] = { d1int, d1 };
	makeUniVectorTube(p, vx, diams, cpx, 1);
	// right
	p[0] = p3;  p[1] = p3;
	diams[0] = d2int;  diams[1] = d2;
	makeUniVectorTube(p, vx, diams, cpx, 1);

	// intersecting tube alfa
	alfa = alfa * (ARX_PI / 180);
	double x = sin(alfa) * l3;
	double y = cos(alfa) * l3;
	FdPoint3d c(0, 0, 0), pc(x, y, 0);
	FdVector3d v(pc - c);
	v.normalize();
	p[0] = p[1] = pc;
	diams[0] = d3int;  diams[1] = d3;
	makeUniVectorTube(p, v, diams, cpx, 1);

	addCenterLine(c, pc);

	// intersecting tube beta
	beta = beta * (ARX_PI / 180);
	x = sin(beta) * l3;
	y = cos(beta) * l3;
	pc.set(x, -y, 0);
	v = pc - c;
	v.normalize();
	p[0] = p[1] = pc;
	diams[0] = d4int;  diams[1] = d4;
	makeUniVectorTube(p, v, diams, cpx, 1);

	addCenterLine(c, pc);

	if( p2.x != p3.x )
		{
		// end tube out
		p[0] = p2;  p[1] = p3;
		makeSimpleTube(p, d1, d2, cpx);

		// end tube in
		makeSimpleTube(p, d1int, d2int, cpx);
		};

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		d1int = d1;  d2int = d2;  d3int = d3;  d4int = d4;
		d1 += 2 * size;  d2 += 2 * size;  d3 += 2 * size;  d4 += 2 * size;

		get_val("alfa", alfa);
		get_val("beta", beta);

		alfa = 90 - alfa;
		beta = 90 - beta;

		// alfa out
		FdPoint3d p1(-l1,      0, 0),
		          p2( l2 - l5, 0, 0),
		          p3( l2,      0, 0);
		double tubeData[2] = { d1, l1 + l2 - l5 };
		double interTubeData[4] = { d3, l3, l1, 0 };
		double angles[2] = { alfa, 270 };
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

		// beta out
		angles[0] = beta;  angles[1] = 90;
		interTubeData[0] = d4;  interTubeData[1] = l4;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, true);

		// caps...
		// left
		FdPoint3d p[2] = { p1, p1 };
		double diams[2] = { d1int, d1 };
		makeUniVectorTube(p, vx, diams, cpx, 1);
		// right
		p[0] = p3;  p[1] = p3;
		diams[0] = d2int;  diams[1] = d2;
		makeUniVectorTube(p, vx, diams, cpx, 1);

		// intersecting tube alfa
		alfa = alfa * (ARX_PI / 180);
		double x = sin(alfa) * l3;
		double y = cos(alfa) * l3;
		FdPoint3d c(0, 0, 0), pc(x, y, 0);
		FdVector3d v(pc - c);
		v.normalize();
		p[0] = p[1] = pc;
		diams[0] = d3int;  diams[1] = d3;
		makeUniVectorTube(p, v, diams, cpx, 1);

		// intersecting tube beta
		beta = beta * (ARX_PI / 180);
		x = sin(beta) * l3;
		y = cos(beta) * l3;
		pc.set(x, -y, 0);
		v = pc - c;
		v.normalize();
		p[0] = p[1] = pc;
		diams[0] = d4int;  diams[1] = d4;
		makeUniVectorTube(p, v, diams, cpx, 1);

		if( p2.x != p3.x )
			{
			// end tube out
			p[0] = p2;  p[1] = p3;
			makeSimpleTube(p, d1, d2, cpx);
			};
		};

	return 0;
	};

short CGeneralBlockCreator :: makeEWLD()
	{
	double l1 = 50, l2 = 50, r = 300, alfa = 90, df = 50, dm = 40, dint = 30, tl = 0;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("r", r);
	get_val("alfa", alfa);
	get_val("dext", dm);
	get_val("dint", dint);

	df = dm;
	double y1 = 0;
	double y2 = 0;
	double beta = (alfa / 2) * (ARX_PI / 180);
	double mcd = r - r * tan(beta);

	FdPoint3d p1   (0, -l1 - r           + mcd, 0),
	          p2   (0, -l1 - r + tl      + mcd, 0);
	FdPoint3d p3in (0, -l1 - r + tl + y1 + mcd, 0),
	          p3out(0, -l1 - r + tl + y2 + mcd, 0);
	FdPoint3d p4   (0,     - r           + mcd, 0);

	double alfa2 = alfa * (ARX_PI / 180);
	double xx = cos(alfa2) * r;
	double yy = sin(alfa2) * r;
	FdPoint3d pn(p4.x + r - xx, p4.y + yy, p4.z);
	FdVector3d v(vy);
	v.rotateBy(alfa2, -vz);
	FdVector3d copyv = v;
	v.normalize();
	v *= l2;

	FdPoint3d p5(pn);
	FdPoint3d p8(p5);
	p8 += v;

	// in bottom
	FdPoint3d p[2] = { p1, p4 };
	double diams[2] = { dint, dint };
	makeUniVectorTube(p, vy, diams, cpx, 1);

	addCenterLine(p1, p4);

	// out bottom
	FdPoint3d pp[3] = { p1, p1, p4 };
	double diams2[3] = { dint, dm, dm };
	makeUniVectorTube(pp, vy, diams2, cpx, 2);

	// in bend
	FdPoint3d pc(p4);  pc.x += r;
	makeDonutSection(pc, -vz, -vx, r, dint, alfa, cpx, cpx);

	addCenterArc(pc, -vz, -vx, r, 0, alfa2);

	// out bend
	makeDonutSection(pc, -vz, -vx, r, dm, alfa, cpx, cpx);

	// in top
	addCenterLine(p8, p5);

	FdPoint3d ppp[2] = { p8, p5 };
	double diams3[2] = { dint, dint };
	makeUniVectorTube(ppp, -copyv, diams3, cpx, 1);

	// out top
	FdPoint3d pppp[3] = { p8, p8, p5 };
	double diams4[3] = { dint, dm, dm };
	makeUniVectorTube(pppp, -copyv, diams4, cpx, 2);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		dint = dm;
		dm += 2 * size;

		df = dm;
		double y1 = 0;
		double y2 = 0;
		double beta = (alfa / 2) * (ARX_PI / 180);
		double mcd = r - r * tan(beta);

		FdPoint3d p1   (0, -l1 - r           + mcd, 0),
		          p2   (0, -l1 - r + tl      + mcd, 0);
		FdPoint3d p3in (0, -l1 - r + tl + y1 + mcd, 0),
		          p3out(0, -l1 - r + tl + y2 + mcd, 0);
		FdPoint3d p4   (0,     - r           + mcd, 0);

		double alfa2 = alfa * (ARX_PI / 180);
		double xx = cos(alfa2) * r;
		double yy = sin(alfa2) * r;
		FdPoint3d pn(p4.x + r - xx, p4.y + yy, p4.z);
		FdVector3d v(vy);
		v.rotateBy(alfa2, -vz);
		FdVector3d copyv = v;
		v.normalize();
		v *= l2;

		FdPoint3d p5(pn);
		FdPoint3d p8(p5);
		p8 += v;

		// out bottom
		FdPoint3d pp[3] = { p1, p1, p4 };
		double diams2[3] = { dint, dm, dm };
		makeUniVectorTube(pp, vy, diams2, cpx, 2);

		// out bend
		FdPoint3d pc(p4);  pc.x += r;
		makeDonutSection(pc, -vz, -vx, r, dm, alfa, cpx, cpx);

		// out top
		FdPoint3d pppp[3] = { p8, p8, p5 };
		double diams4[3] = { dint, dm, dm };
		makeUniVectorTube(pppp, -copyv, diams4, cpx, 2);
		};

	return 0;
	};

short CGeneralBlockCreator :: makePWLD()
	{
	double L = 100, d = 20, dint = 10;

	get_val("l", L);
	get_val("dext", d);
	get_val("dint", dint);

	FdPoint3d p1(-L / 2, 0, 0),
	          p2( L / 2, 0, 0);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	double diams[4] = { dint, d, d, dint };
	makeUniVectorTube(p, vx, diams, cpx, 3);

	addCenterLine(p1, p2);

	p[0] = p1;  p[1] = p2;
	makeSimpleTube(p, dint, dint, cpx);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		dint = d;
		d += 2 * size;

		FdPoint3d p1(-L / 2, 0, 0),
		          p2( L / 2, 0, 0);
		FdPoint3d p[4] = { p1, p1, p2, p2 };
		double diams[4] = { dint, d, d, dint };
		makeUniVectorTube(p, vx, diams, cpx, 3);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeRWLD()
	{
	double l = 100, d1int = 40, d1ext = 50, d2int = 30, d2ext = 40;

	get_val("l", l);
	get_val("d1ext", d1ext);
	get_val("d2ext", d2ext);
	get_val("d1int", d1int);
	get_val("d2int", d2int);

	FdPoint3d p1(-l / 2, 0, 0),
	          p2( l / 2, 0, 0);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	double diams[4] = { d1int, d1ext, d2ext, d2int };
	makeUniVectorTube(p, vx, diams, cpx, 3);

	addCenterLine(p1, p2);

	p[1] = p2;
	makeSimpleTube(p, d1int, d2int, cpx);

	// p1.set(-l / 6, 0, d1ext / 2);
	// p2.set( l / 6, 0, d1ext / 2);
	// addThinCircle(p1, vz, d1int / 2);
	// addThinCircle(p2, vz, d1int / 2);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		d1int = d1ext;
		d2int = d2ext;
		d1ext += 2 * size;
		d2ext += 2 * size;

		FdPoint3d p1(-l / 2, 0, 0),
		          p2( l / 2, 0, 0);
		FdPoint3d p[4] = { p1, p1, p2, p2 };
		double diams[4] = { d1int, d1ext, d2ext, d2int };
		makeUniVectorTube(p, vx, diams, cpx, 3);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeTSWLD()
	{
	double l = 100, d1int = 40, d1ext = 50, d2int = 30, d2ext = 40;

	get_val("l", l);
	get_val("d1ext", d1ext);
	get_val("d2ext", d2ext);
	get_val("d1int", d1int);
	get_val("d2int", d2int);

	FdPoint3d p1(-l / 2, 0, 0),
	          p2( l / 2, 0, 0);
	FdPoint3d p[4] = { p1, p1, p2, p2 };
	double diams[4] = { d1int, d1ext, d2ext, d2int };
	makeUniVectorTube(p, vx, diams, cpx, 3);

	addCenterLine(p1, p2);

	p[1] = p2;
	makeSimpleTube(p, d1int, d2int, cpx);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		d1int = d1ext;
		d2int = d2ext;
		d1ext += 2 * size;
		d2ext += 2 * size;

		FdPoint3d p1(-l / 2, 0, 0),
		          p2( l / 2, 0, 0);
		FdPoint3d p[4] = { p1, p1, p2, p2 };
		double diams[4] = { d1int, d1ext, d2ext, d2int };
		makeUniVectorTube(p, vx, diams, cpx, 3);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeRTWLD()
	{
	double d1 = 50, d2 = 40, d3 = 40;
	double d1int = 40, d2int = 30, d3int = 30;
	double l1 = 100, l2 = 100, l3 = 100, l4 = 20;
	double alfa = 75;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("l4", l4);
	get_val("d1ext", d1);
	get_val("d2ext", d2);
	get_val("d3ext", d3);
	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("d3int", d3int);
	get_val("alfa", alfa);

	alfa = 90 - alfa;

	// out
	FdPoint3d p1(-l1,      0, 0),
	          p2( l2 - l4, 0, 0),
	          p3( l2,      0, 0);
	double tubeData[2] = { d1, l1 + l2 - l4 };
	double interTubeData[4] = { d3, l3, l1, 0 };
	double angles[2] = { alfa, 270 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	// in
	tubeData[0] = d1int;
	interTubeData[0] = d3int;  // interTubeData[1] = l3;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	addCenterLine(p1, p3);

	// caps...
	// left
	FdPoint3d p[2] = { p1, p1 };
	double diams[2] = { d1int, d1 };
	makeUniVectorTube(p, vx, diams, cpx, 1);
	// right
	p[0] = p3;  p[1] = p3;
	diams[0] = d2int;  diams[1] = d2;
	makeUniVectorTube(p, vx, diams, cpx, 1);

	// intersecting tube
	alfa = alfa * (ARX_PI / 180);
	double x = sin(alfa) * l3;
	double y = cos(alfa) * l3;
	FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);
	FdVector3d v(pc - c);
	v.normalize();
	p[0] = p[1] = pc;
	diams[0] = d3int;  diams[1] = d3;
	makeUniVectorTube(p, v, diams, cpx, 1);

	addCenterLine(c, pc);

	if( l4 != 0 )
		{
		// end tube out
		p[0] = p2;  p[1] = p3;
		makeSimpleTube(p, d1, d2, cpx);

		// end tube in
		makeSimpleTube(p, d1int, d2int, cpx);
		};

	/**********************************Ext Insulation*******************************/
	double size, __ins_width, __int_width2;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		get_val("d1ext", d1);
		get_val("d2ext", d2);
		get_val("d3ext", d3);
		get_val("d1int", d1int);
		get_val("d2int", d2int);
		get_val("d3int", d3int);
		get_val("alfa", alfa);
		get_val("__ins_width", __ins_width);
		get_val("__int_width2", __int_width2);

		alfa = 90 - alfa;
		d1int = d1;  d1 += 2 * __ins_width;
		d2int = d2;  d2 += 2 * __ins_width;
		d3int = d3;  d3 += 2 * __int_width2;

		// out
		FdPoint3d p1(-l1,      0, 0),
		          p2( l2 - l4, 0, 0),
		          p3( l2,      0, 0);
		double tubeData[2] = { d1, l1 + l2 - l4 };
		double interTubeData[4] = { d3, l3, l1, 0 };
		double angles[2] = { alfa, 270 };
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

		// caps...
		// left
		FdPoint3d p[2] = { p1, p1 };
		double diams[2] = { d1int, d1 };
		makeUniVectorTube(p, vx, diams, cpx, 1);
		// right
		p[0] = p3;  p[1] = p3;
		diams[0] = d2int;  diams[1] = d2;
		makeUniVectorTube(p, vx, diams, cpx, 1);

		// intersecting tube
		alfa = alfa * (ARX_PI / 180);
		double x = sin(alfa) * l3;
		double y = cos(alfa) * l3;
		FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);
		FdVector3d v(pc - c);
		v.normalize();
		p[0] = p[1] = pc;
		diams[0] = d3int;  diams[1] = d3;
		makeUniVectorTube(p, v, diams, cpx, 1);

		if( l4 != 0 )
			{
			// end tube out
			p[0] = p2;  p[1] = p3;
			makeSimpleTube(p, d1, d2, cpx);
			};
		};

	return 0;
	};

short CGeneralBlockCreator :: makeSTWLD()
	{
	double l1 = 200, l2 = 200, l3 = 200;
	double d = 50, tl = 20, alfa = 90, dint = 30;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("dext", d);
	get_val("tl", tl);
	get_val("alfa", alfa);
	get_val("dint", dint);

	alfa = 90 - alfa;

	// out
	FdPoint3d p1(-l1, 0, 0),
	          p2( l2, 0, 0);
	double tubeData[2] = { d, l1 + l2 };
	double interTubeData[4] = { d, l3, l1, 0 };
	double angles[2] = { alfa, 270 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	// in
	tubeData[0] = dint;
	interTubeData[0] = dint;  // interTubeData[1] = l3;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

	addCenterLine(p1, p2);

	// caps...
	// left
	FdPoint3d p[2] = { p1, p1 };
	double diams[2] = { dint, d };
	makeUniVectorTube(p, vx, diams, cpx, 1);
	// right
	p[0] = p2;  p[1] = p2;
	makeUniVectorTube(p, vx, diams, cpx, 1);

	// intersecting tube
	alfa = alfa * (ARX_PI / 180);
	double x = sin(alfa) * l3;
	double y = cos(alfa) * l3;
	FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);
	FdVector3d v(pc - c);
	p[0] = p[1] = pc;
	makeUniVectorTube(p, v, diams, cpx, 1);

	addCenterLine(c, pc);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		get_val("alfa", alfa);

		alfa = 90 - alfa;
		dint = d;  d += 2 * size;

		// out
		FdPoint3d p1(-l1, 0, 0),
		          p2( l2, 0, 0);
		double tubeData[2] = { d, l1 + l2 };
		double interTubeData[4] = { d, l3, l1, 0 };
		double angles[2] = { alfa, 270 };
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, cpx, false);

		// caps...
		// left
		FdPoint3d p[2] = { p1, p1 };
		double diams[2] = { dint, d };
		makeUniVectorTube(p, vx, diams, cpx, 1);
		// right
		p[0] = p2;  p[1] = p2;
		makeUniVectorTube(p, vx, diams, cpx, 1);

		// intersecting tube
		alfa = alfa * (ARX_PI / 180);
		double x = sin(alfa) * l3;
		double y = cos(alfa) * l3;
		FdPoint3d c(0, 0, 0), pc(l3 * sin(alfa), l3 * cos(alfa), 0);
		FdVector3d v(pc - c);
		p[0] = p[1] = pc;
		makeUniVectorTube(p, v, diams, cpx, 1);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeCOWLD()
	{
	double R = 30;
	double d1ext = 50, d1int = 30, d2ext = 40;
	double d2int = 10, d3ext = 60, d3int = 50;
	double l1 = 120, l2 = 150, l3 = 200;

	get_val("d1int", d1int);
	get_val("d2int", d2int);
	get_val("d3int", d3int);
	get_val("d1ext", d1ext);
	get_val("d2ext", d2ext);
	get_val("d3ext", d3ext);
	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);

	R = max(max(d1ext, d2ext), d3ext);
	R = R / 2.0;

	FdPoint3d p1(1, 0, 0), p2(0, 0, 0), p0(0, 0, 0);
	FdPoint3d p[2] = { p1, p2 };
	double latAngles[2] = { 0, 180 };
	double longAngles[2] = { 0, 360 };
	double tab1[3] = { 2 * R, 2 * R, 2 * R };
	int n[2] = { cpx, 4 * cpx };
	makeSpheroidSection(p2, vx, vy, latAngles, longAngles, tab1, n);

	//
	p1.set(-sqrt(R * R - d1ext * d1ext * 0.25), 0, 0);
	p2.set(-sqrt(R * R - d1ext * d1ext * 0.25) - l1, 0, 0);
	p[0] = p1;  p[1] = p2;
	FdPoint3d p3(-sqrt(R * R - d1ext * d1ext * 0.25) - l1, 0, 0);
	FdPoint3d k[3] = { p1, p2, p3 };
	double diam[3] = { d1ext, d1ext, d1int };
	makeUniVectorTube(k, -vx, diam, cpx, 2);
	makeSimpleTube(p, d1int, d1int, cpx);

	addCenterLine(p0, p2);

	//
	p1.set(0, 0, sqrt(R * R - d2ext * d2ext * 0.25));
	p2.set(0, 0, sqrt(R * R - d2ext * d2ext * 0.25) + l2);
	p3.set(0, 0, sqrt(R * R - d2ext * d2ext * 0.25) + l2);
	k[0] = p1;  k[1] = p2;  k[2] = p3;
	diam[0] = d2ext;  diam[1] = d2ext;  diam[2] = d2int;
	makeUniVectorTube(k, -vz, diam, cpx, 2);
	p[0] = p1;  p[1] = p2;
	makeSimpleTube(p, d2int, d2int, cpx);

	addCenterLine(p0, p2);

	//
	p1.set(0, sqrt(R * R - d3ext * d3ext * 0.25), 0);
	p2.set(0, sqrt(R * R - d3ext * d3ext * 0.25) + l3, 0);
	p3.set(0, sqrt(R * R - d3ext * d3ext * 0.25) + l3, 0);
	k[0] = p1;  k[1] = p2;  k[2] = p3;
	diam[0] = d3ext;  diam[1] = d3ext;  diam[2] = d3int;
	makeUniVectorTube(k, -vy, diam, cpx, 2);
	p[0] = p1;  p[1] = p2;
	makeSimpleTube(p, d3int, d3int, cpx);

	addCenterLine(p0, p2);

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		d1int = d1ext;
		d2int = d2ext;
		d3int = d3ext;
		d1ext += 2 * size;
		d2ext += 2 * size;
		d3ext += 2 * size;
		R += size;

		FdPoint3d p1(1, 0, 0), p2(0, 0, 0), p0(0, 0, 0);
		FdPoint3d p[2] = { p1, p2 };
		double latAngles[2] = { 0, 180 };
		double longAngles[2] = { 0, 360 };
		double tab1[3] = { 2 * R, 2 * R, 2 * R };
		int n[2] = { cpx, 4 * cpx };
		makeSpheroidSection(p2, vx, vy, latAngles, longAngles, tab1, n);

		//
		p1.set(-sqrt(R * R - d1ext * d1ext * 0.25), 0, 0);
		p2.set(-sqrt(R * R - d1ext * d1ext * 0.25) - l1, 0, 0);
		p[0] = p1;  p[1] = p2;
		FdPoint3d p3(-sqrt(R * R - d1ext * d1ext * 0.25) - l1, 0, 0);
		FdPoint3d k[3] = { p1, p2, p3 };
		double diam[3] = { d1ext, d1ext, d1int };
		makeUniVectorTube(k, -vx, diam, cpx, 2);
		makeSimpleTube(p, d1int, d1int, cpx);

		//
		p1.set(0, 0, sqrt(R * R - d2ext * d2ext * 0.25));
		p2.set(0, 0, sqrt(R * R - d2ext * d2ext * 0.25) + l2);
		p3.set(0, 0, sqrt(R * R - d2ext * d2ext * 0.25) + l2);
		k[0] = p1;  k[1] = p2;  k[2] = p3;
		diam[0] = d2ext;  diam[1] = d2ext;  diam[2] = d2int;
		makeUniVectorTube(k, -vz, diam, cpx, 2);
		p[0] = p1;  p[1] = p2;
		makeSimpleTube(p, d2int, d2int, cpx);

		//
		p1.set(0, sqrt(R * R - d3ext * d3ext * 0.25), 0);
		p2.set(0, sqrt(R * R - d3ext * d3ext * 0.25) + l3, 0);
		p3.set(0, sqrt(R * R - d3ext * d3ext * 0.25) + l3, 0);
		k[0] = p1;  k[1] = p2;  k[2] = p3;
		diam[0] = d3ext;  diam[1] = d3ext;  diam[2] = d3int;
		makeUniVectorTube(k, -vy, diam, cpx, 2);
		p[0] = p1;  p[1] = p2;
		makeSimpleTube(p, d3int, d3int, cpx);
		};

	return 0;
	};


	/*******************************SYMBOLS*************************/
	/*******************************SYMBOLS*************************/
	/*******************************SYMBOLS*************************/
	short CGeneralBlockCreator ::  makeVent(FdPoint3d pt, FdVector3d v, FdVector3d upv, ads_real rad, bool circle)
		{  makeCircleSymbol(pt, v, upv, 2 * rad, fdTriangleFilled);  return 0;  };

	short CGeneralBlockCreator :: makeHSym(FdPoint3d pt, FdVector3d v, FdVector3d upv, ads_real rad, short typ)
		{
		switch( typ )
			{
			case 0:  makeCircleSymbol(pt, v, upv, 2 * rad, fdMinus);      break;
			case 1:  makeCircleSymbol(pt, v, upv, 2 * rad, fdPlus);       break;
			case 2:  makeCircleSymbol(pt, v, upv, 2 * rad, fdPlusMinus);  break;
			};
		return 0;
		};

void CGeneralBlockCreator :: makeCircleWithPlusAndMinus(FdPoint3d c, FdVector3d v, FdVector3d upv, double diam)
	{
	FdVector3d vector2, downUp2, leftRight;
	vector2.set(v.x, v.y, v.z);
	downUp2.set(upv.x, upv.y, upv.z);
	FdPoint3d center2, p1, p2;
	center2.set(c.x, c.y, c.z);

	leftRight = downUp2;
	leftRight.rotateBy(ARX_PI / 2, vector2);

	// !!! Remember to add a circle !!!
	ads_point ap1,ap2;
	p1 = center2 + downUp2 * (diam * (2.0 / 3.0)) / 2.0;
	p2 = center2;
	setpt(ap1, p1.x, p1.y, p1.z);
	setpt(ap2, p2.x, p2.y, p2.z);
	make_thin_line(ap1, ap2);

	p1 = center2 + leftRight * (diam / 3.0) / 2 + downUp2 * (diam / 3.0) / 2;
	p2 = center2 - leftRight * (diam / 3.0) / 2 + downUp2 * (diam / 3.0) / 2;
	setpt(ap1, p1.x, p1.y, p1.z);
	setpt(ap2, p2.x, p2.y, p2.z);
	make_thin_line(ap1, ap2);

	p1 = center2 + leftRight * (diam / 3.0) / 2 - downUp2 * (diam / 3.0) / 2;
	p2 = center2 - leftRight * (diam / 3.0) / 2 - downUp2 * (diam / 3.0) / 2;
	setpt(ap1, p1.x, p1.y, p1.z);
	setpt(ap2, p2.x, p2.y, p2.z);
	make_thin_line(ap1, ap2);
	};

short CGeneralBlockCreator :: makeCGrill(FdPoint3d c, FdVector3d v, FdVector3d upv, ads_real width, ads_real height)
	{
	FdVector3d vector2, downUp2, leftRight;
	vector2.set(v.x, v.y, v.z);
	downUp2.set(upv.x, upv.y, upv.z);
	FdPoint3d center2, p1, p2, p3, p4;
	center2.set(c.x, c.y, c.z);

	leftRight = downUp2;
	leftRight.rotateBy(ARX_PI / 2.0, vector2);

	p1 = center2 - leftRight * width / 2.0 - downUp2 * height / 2.0;
	p2 = center2 + leftRight * width / 2.0 - downUp2 * height / 2.0;
	p3 = center2 + leftRight * width / 2.0 + downUp2 * height / 2.0;
	p4 = center2 - leftRight * width / 2.0 + downUp2 * height / 2.0;

	makeSymbolicLine(p1, p2);
	makeSymbolicLine(p2, p3);
	makeSymbolicLine(p3, p4);
	makeSymbolicLine(p4, p1);

	int num = (int) floor(width / 50.0);
	for( int i = 0; i <= num; i++ )
		{
		p3 = p1 + leftRight * i * 50;
		p2 = p4 + leftRight * i * 50;
		makeSymbolicLine(p3, p2);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeBUTTV()
	{
	postTransformMesh(ARX_PI / 2, FdVector3d::kXAxis);

	ads_real DN;
	get_val("DN", DN);

	ads_real L1;
	get_val("L1", L1);

	ads_real H1;
	get_val("H1", H1);

	ads_real H2;
	get_val("H2", H2);

	ads_real E;
	get_val("E", E);

	// WCHAR w1[] = { L"centering" };
	WCHAR w2[] = { L"tapped" };

	WCHAR wd[40] = { L"" };
	WCHAR *wdp = wd;

	get_val("conn", wdp);
	BOOL bCenter_lugs = TRUE;
	if( wcsstr(wdp, w2) != NULL )
		bCenter_lugs = FALSE;

	// WCHAR w12[] = { L"gear" };
	WCHAR w22[] = { L"hand" };

	get_val("act", wdp);
	BOOL bGear_box = TRUE;
	if( wcsstr(wdp, w22) != NULL )
		bGear_box = FALSE;


	double a = L1 / 0.462;
	double l = L1 / 0.7;  // 0.952
	double b = E / 0.1063;

	double diamTubeOut = L1;  // a * 0.462  // DN
	double diamTubeIn = DN;   // a * 0.405  // L1

	double shiftCPtube = a * 0.079;
	//                                a * 0.462     a * 0.079
	// double startBox2 = -a / 2.0 + diamTubeOut + shiftCPtube + a * 0.0527 + a * 0.2345 + a * 0.10

	double dLongtube = E;  // b * 0.1063
	double zTube_1 = -dLongtube / 2;
	double zTube_2 =  dLongtube / 2;

	// double xCP = -l / 2 + l / 3;
	double xCP = 0;

	int n = 5;
	if( bCenter_lugs == FALSE )
		n = 8;

	// FdPoint3d p1_n(xCP, -a / 2.0 + diamTubeOut / 2 + shiftCPtube, zTube_1);
	// FdPoint3d p2_n(xCP, -a / 2.0 + diamTubeOut / 2 + shiftCPtube, zTube_2);
	FdPoint3d p1_n(0, 0, zTube_1);
	FdPoint3d p2_n(0, 0, zTube_2);

	makeFlatRing(p2_n, vz, diamTubeOut, diamTubeIn, n);

	if( bCenter_lugs == TRUE )
		{
		double tubeParams[3] = { diamTubeOut, diamTubeOut, b * 0.1063 * 1.0 };
		double ductPosition[2] = { b * 0.1063 / 2, 0 };  // { b * 0.213 / 2, b * 0.213 / 2 }
		double ductParams[3] = { b * 0.1063, l * 0.433, diamTubeOut / 2 };

		makeRectToTubeIntersection(p2_n, -vz, -vx, tubeParams, ductPosition, ductParams, n);
		makeRectToTubeIntersection(p2_n, -vz,  vx, tubeParams, ductPosition, ductParams, n);
		}
	else
		{
		makeFlatRing(p1_n, vz, diamTubeOut * 1.32, diamTubeOut, n);
		makeFlatRing(p2_n, vz, diamTubeOut * 1.32, diamTubeOut, n);

		makeVerySimpleTube(p1_n, p2_n, diamTubeOut,        n);
		makeVerySimpleTube(p1_n, p2_n, diamTubeOut * 1.32, n);
		};


	// double startBox1 = diamTubeIn / 2; 
	// double startBox1 = -a / 2.0 + diamTubeOut - (diamTubeOut - diamTubeIn) / 2 + shiftCPtube;
	double startBox1 = diamTubeIn / 2;
	double startBox2 = diamTubeOut / 2;

	double dWithBox1 = b * 0.213;
	double dHeightBo1_1 = l * 0.0983;
	double dHeightBo1_2 = l * 0.063;

	double zCPbox1 = -b * 0.0266;

	p1_n.set(xCP, startBox1, zCPbox1);
	// p2_n.set(xCP, startBox1 + a * 0.266, zCPbox1);
	p2_n.set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 - a * 0.055 - a * 0.0532 - a * 0.0416, zCPbox1);

	// FdPoint3d p3_n(xCP, startBox1 + a * 0.266, zCPbox1);
	// FdPoint3d p4_n(xCP, startBox1 + a * 0.266 + a * 0.0416, zCPbox1);
	// FdPoint3d p5_n(xCP, startBox1 + a * 0.266 + a * 0.0416, zCPbox1);
	// FdPoint3d p6_n(xCP, startBox1 + a * 0.266 + a * 0.0416 + a * 0.0532, zCPbox1);
	// FdPoint3d p7_n(xCP, startBox1 + a * 0.266 + a * 0.0416 + a * 0.0532, zCPbox1);
	// FdPoint3d p8_n(xCP, startBox1 + a * 0.266 + a * 0.0416 + a * 0.0532 + a * 0.055, zCPbox1);

	FdPoint3d p3_n(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 - a * 0.055 - a * 0.0532 - a * 0.0416, zCPbox1);
	FdPoint3d p4_n(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 - a * 0.055 - a * 0.0532, zCPbox1);
	FdPoint3d p5_n(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 - a * 0.055 - a * 0.0532, zCPbox1);
	FdPoint3d p6_n(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 - a * 0.055, zCPbox1);
	FdPoint3d p7_n(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 - a * 0.055, zCPbox1);
	FdPoint3d p8_n(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10, zCPbox1);

	FdPoint3d arrP[14] = { p1_n, p2_n, p3_n, p4_n, p5_n, p6_n, p7_n, p8_n };
	FdVector3d arrV[14] = { vy, vy, vy, vy, vy, vy, vy, vy, vy, vy, vy, vy, vy, vy };
	FdVector3d arrVu[14] = { vx, vx, vx, vx, vx, vx, vx, vx, vx, vx, vx, vx, vx, vx };
	double arrWidth[14] = { dWithBox1, dWithBox1, dWithBox1, dWithBox1, dWithBox1, dWithBox1, dWithBox1, dWithBox1 };
	double arrHeight[14] = { dHeightBo1_1, dHeightBo1_1, dHeightBo1_2, dHeightBo1_2, dHeightBo1_1, dHeightBo1_1, dHeightBo1_2, dHeightBo1_2 };
	bool arrSides[14 * 4] = { true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true,
	                          true, true, true, true };
	bool arrEdges[][4] = { true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true,
	                       true, true, true, true };
	bool con_n[2] = { true, true };

	makeBox(7, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);


	// double startBox2 = -a / 2.0 + diamTubeOut + shiftCPtube;
	// double startBox2 = diamTubeOut / 2;

	double ad100 = a * 0.0395;
	double ad60  = a * 0.0237;
	double ad50  = a * 0.0198;
	double ad30  = a * 0.0119;
	double ad10  = a * 0.0079;
	double ad20  = a * 0.004;

	double ld100 = l * 0.059;
	double ld60  = l * 0.0354;
	double ld50  = l * 0.0295;
	double ld30  = l * 0.0177;
	double ld20  = l * 0.0118;
	double ld10  = l * 0.0059;


	if( bCenter_lugs == TRUE )
		{
		arrP[0].set(xCP, startBox2, 0);

		arrP[1].set(xCP, startBox2 + a * 0.0527 - ad50, 0);
		arrP[2].set(xCP, startBox2 + a * 0.0527,        0);

		arrP[3].set(xCP, startBox2 + a * 0.0527,        0);
		arrP[4].set(xCP, startBox2 + a * 0.0527 + ad20, 0);

		arrP[5].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 - ad20, 0);
		arrP[6].set(xCP, startBox2 + a * 0.0527 + a * 0.2345,        0);

		arrP[7].set(xCP, startBox2 + a * 0.0527 + a * 0.2345,              0);
		arrP[8].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.0421, 0);

		arrP[ 9].set(xCP + (l * 0.4544 - l * 0.433) / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.0421, 0);
		arrP[10].set(xCP + (l * 0.4544 - l * 0.433) / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10,   0);

		arrP[11].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10,                    0);
		arrP[12].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064 - ad20, 0);
		arrP[13].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064,        0);
		}
	else
		{
		arrP[0].set(xCP, startBox2 + a * 0.0527              + ad30, 0);
		arrP[1].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 - ad20, 0);
		arrP[2].set(xCP, startBox2 + a * 0.0527 + a * 0.2345,        0);

		arrP[3].set(xCP, startBox2 + a * 0.0527 + a * 0.2345,              0);
		arrP[4].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.0421, 0);

		arrP[5].set(xCP + (l * 0.4544 - l * 0.433) / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.0421, 0);
		arrP[6].set(xCP + (l * 0.4544 - l * 0.433) / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10,   0);

		arrP[7].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10,                    0);
		arrP[8].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064 - ad20, 0);
		arrP[9].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064,        0);
		};


	arrWidth[0] = arrWidth[1] = arrWidth[2] = arrWidth[3] = arrWidth[4] = arrWidth[5] = arrWidth[6] = dLongtube;
	arrWidth[7] = arrWidth[8] = arrWidth[9] = arrWidth[10] = arrWidth[11] = arrWidth[12] = arrWidth[13] = dLongtube;

	if( bCenter_lugs == TRUE )
		{
		arrHeight[0] = l * 0.433;
		arrHeight[1] = l * 0.433;
		arrHeight[2] = l * 0.433 - ld50 - ld50;

		arrHeight[3] = l * 0.192 + ld20 + ld20;
		arrHeight[4] = l * 0.192;

		arrHeight[5] = l * 0.192;
		arrHeight[6] = l * 0.192 + ld10 + ld10;
		arrHeight[7] = l * 0.433;
		arrHeight[8] = l * 0.433;

		arrHeight[ 9] = l * 0.4544;
		arrHeight[10] = l * 0.4544;
		arrHeight[11] = l * 0.16;
		arrHeight[12] = l * 0.16;
		arrHeight[13] = l * 0.16 - ld20;

		makeBox(13, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);
		}
	else
		{
		arrHeight[0] = l * 0.192;
		arrHeight[1] = l * 0.192;
		arrHeight[2] = l * 0.192 + ld10 + ld10;
		arrHeight[3] = l * 0.433;
		arrHeight[4] = l * 0.433;
		arrHeight[5] = l * 0.4544;
		arrHeight[6] = l * 0.4544;
		arrHeight[7] = l * 0.16;
		arrHeight[8] = l * 0.16;
		arrHeight[9] = l * 0.16 - ld20;

		makeBox(9, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);
		};



	double ll = l * 0.12;

	arrP[0].set(xCP - l * 0.0315 - ll / 2 - l * 0.063 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 - a * 0.0458 - a * 0.00975 / 2, -dLongtube / 2);
	makeAssemblyHole(arrP[0], -vz, -vx, ll, a * 0.00975);

	arrP[0].set(xCP - l * 0.0315 - ll / 2 - l * 0.063 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 - a * 0.0458 - a * 0.00975 / 2,  dLongtube / 2);
	makeAssemblyHole(arrP[0], -vz, -vx, ll, a * 0.00975);

	arrP[0].set(xCP + l * 0.0315 + ll / 2 + l * 0.063 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 - a * 0.0458 - a * 0.00975 / 2, -dLongtube / 2);
	makeAssemblyHole(arrP[0], -vz, -vx, ll, a * 0.00975);

	arrP[0].set(xCP + l * 0.0315 + ll / 2 + l * 0.063 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 - a * 0.0458 - a * 0.00975 / 2,  dLongtube / 2);
	makeAssemblyHole(arrP[0], -vz, -vx, ll, a * 0.00975);



	double diam2 = l * 0.074;
	if( a * 0.05 < diam2 )
		diam2 = a * 0.05;
	if( bCenter_lugs == TRUE )
		{
		// зеленые круги на верхнем выступе

		arrP[0].set(xCP - l * 0.0983 / 2 - l * 0.0775 - diam2 / 2, startBox2 + a * 0.052 - a * 0.021 - diam2 / 2, -dLongtube / 2);
		makeSymbolicCircle(arrP[0], vz, diam2);
		arrP[0].set(xCP - l * 0.0983 / 2 - l * 0.0775 - diam2 / 2, startBox2 + a * 0.052 - a * 0.021 - diam2 / 2,  dLongtube / 2);
		makeSymbolicCircle(arrP[0], vz, diam2);
		arrP[0].set(xCP + l * 0.0983 / 2 + l * 0.0775 + diam2 / 2, startBox2 + a * 0.052 - a * 0.021 - diam2 / 2, -dLongtube / 2);
		makeSymbolicCircle(arrP[0], vz, diam2);
		arrP[0].set(xCP + l * 0.0983 / 2 + l * 0.0775 + diam2 / 2, startBox2 + a * 0.052 - a * 0.021 - diam2 / 2,  dLongtube / 2);
		makeSymbolicCircle(arrP[0], vz, diam2);


		// нижний выступ под главной дырой
		arrP[0].set(xCP, -diamTubeOut / 2,                     0);
		arrP[1].set(xCP, -diamTubeOut / 2 - a * 0.0527 + ad50, 0);
		arrP[2].set(xCP, -diamTubeOut / 2 - a * 0.0527,        0);
		arrP[3].set(xCP, -diamTubeOut / 2 - a * 0.0527,        0);
		arrP[4].set(xCP, -diamTubeOut / 2 - a * 0.1054,        0);

		arrWidth[0] = arrWidth[1] = arrWidth[2] = arrWidth[3] = arrWidth[4] = arrWidth[5] = arrWidth[6] = dLongtube;

		arrHeight[0] = l * 0.433;
		arrHeight[1] = l * 0.433;
		arrHeight[2] = l * 0.433 - ld50 - ld50;
		arrHeight[3] = l * 0.1317;
		arrHeight[4] = l * 0.09;

		makeBox(4, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);

		// зеленые круги на нижнем  выступе
		// diam2 = l * 0.074;
		// if( a * 0.05 < diam2 )
		// 	diam2 = a * 0.05;
		arrP[0].set(xCP - l * 0.0983 / 2 - l * 0.0775 - diam2 / 2, -diamTubeOut / 2 - a * 0.052 + a * 0.021 + diam2 / 2, -dLongtube / 2);
		makeSymbolicCircle(arrP[0], vz, diam2);
		arrP[0].set(xCP - l * 0.0983 / 2 - l * 0.0775 - diam2 / 2, -diamTubeOut / 2 - a * 0.052 + a * 0.021 + diam2 / 2,  dLongtube / 2);
		makeSymbolicCircle(arrP[0], vz, diam2);
		arrP[0].set(xCP + l * 0.0983 / 2 + l * 0.0775 + diam2 / 2, -diamTubeOut / 2 - a * 0.052 + a * 0.021 + diam2 / 2, -dLongtube / 2);
		makeSymbolicCircle(arrP[0], vz, diam2);
		arrP[0].set(xCP + l * 0.0983 / 2 + l * 0.0775 + diam2 / 2, -diamTubeOut / 2 - a * 0.052 + a * 0.021 + diam2 / 2,  dLongtube / 2);
		makeSymbolicCircle(arrP[0], vz, diam2);
		}
	else
		{
		// выступы по кругу

		double ran = M_PI * 90 / 8 / 180.0;
		// startBox2 = -a / 2.0 + diamTubeOut + shiftCPtube;
		// double yStart5 = startBox2 + (diamTubeOut * 1.32 - diamTubeOut) / 2 + (diamTubeOut * 1.68 - diamTubeOut * 1.32) / 4;
		double xW = diamTubeOut / 2 * 1.32 * sin(ran) * 2;  // diamTubeOut / 2 * 1.32 * M_PI * 22.5 / 180.0;  // 22.5 = 90 / 4
		double yH = (diamTubeOut * 1.68 - diamTubeOut * 1.32) / 2;
		double ySh = yH;

		double r = M_PI * 90 / 4 / 180.0;
		for( int i = 0; i < 8; i++ )
			{
			FdPoint3d pR(xCP, 0, 0);
			FdPoint3d pBr(xCP, diamTubeOut * 1.31 / 2, 0);
			pBr.rotateBy(ran + ran * i * 4, vz, pR);

			FdPoint3d pC(pBr.x - xW * 0.5, pBr.y + ySh * 0.35, dLongtube / 2);
			pC.rotateBy(ran * 2 + ran * i * 4, vz, pBr);

			FdPoint3d pB1(pBr.x,            pBr.y + ySh * 0.7 / 2, 0);
			FdPoint3d pB2(pBr.x - xW * 0.3, pBr.y + ySh / 1.76,    0);
			FdPoint3d pB3(pBr.x - xW * 0.5, pBr.y + ySh / 1.68,    0);
			FdPoint3d pB4(pBr.x - xW * 0.7, pBr.y + ySh / 1.76,    0);
			FdPoint3d pB5(pBr.x - xW,       pBr.y + ySh * 0.7 / 2, 0);

			pB1.rotateBy(ran * 2 + ran * i * 4, vz, pBr);
			pB2.rotateBy(ran * 2 + ran * i * 4, vz, pBr);
			pB3.rotateBy(ran * 2 + ran * i * 4, vz, pBr);
			pB4.rotateBy(ran * 2 + ran * i * 4, vz, pBr);
			pB5.rotateBy(ran * 2 + ran * i * 4, vz, pBr);

			FdPoint3d arrP3[] = { pB1, pB2, pB3, pB4, pB5 };

			arrWidth[0] = yH * 0.7;
			arrWidth[1] = yH;
			arrWidth[2] = yH;
			arrWidth[3] = yH;
			arrWidth[4] = yH * 0.7;

			arrHeight[0] = arrHeight[1] = arrHeight[2] = arrHeight[3] = arrHeight[4] = dLongtube;

			FdVector3d arrV2[] = { -vx, -vx, -vx, -vx, -vx, -vx };
			FdVector3d arrVu2[] = { vz, vz, vz, vz, vz, vz };

			arrV2[0] = arrV2[1] = arrV2[2] = arrV2[3] = arrV2[4] = -vx;
			arrVu2[0] = arrVu2[1] = arrVu2[2] = arrVu2[3] = arrVu2[4] = vz;

			arrV2[0].rotateBy(ran * 2 + ran * i * 4, vz);
			arrV2[0].rotateBy(ran, vz);
			arrV2[1].rotateBy(ran * 2 + ran * i * 4, vz);
			arrV2[2].rotateBy(ran * 2 + ran * i * 4, vz);
			arrV2[3].rotateBy(ran * 2 + ran * i * 4, vz);
			arrV2[4].rotateBy(ran * 2 + ran * i * 4, vz);
			arrV2[4].rotateBy(-ran, vz);

			makeBox(4, arrP3, arrV2, arrVu2, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);

			makeSymbolicCircle(pC, vz, xW * 0.2);
			pC.z -= dLongtube;
			makeSymbolicCircle(pC, vz, xW * 0.2);
			};
		};


	// коробочка в самом верху и сзади
	arrP[0].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10,              -dLongtube / 2 + zCPbox1 / 2);  // zCPbox1 minus
	arrP[1].set(xCP, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.0522, -dLongtube / 2 + zCPbox1 / 2);
	arrWidth[0] = arrWidth[1] = b * 0.0266;
	arrHeight[0] = arrHeight[1] = l * 0.0983;

	makeBox(1, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);


	// выступ сверху слева с дырками
	arrP[0].set(xCP - l * 0.16 / 2 - l * 0.0181 - l * 0.0933 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10,                  0);  // zCPbox1 minus
	arrP[1].set(xCP - l * 0.16 / 2 - l * 0.0181 - l * 0.0933 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.0234 / 2, 0);
	arrP[2].set(xCP - l * 0.16 / 2 - l * 0.0181 - l * 0.0933 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.0234,     0);
	arrWidth[0] = arrWidth[1] = arrWidth[2] = dLongtube;
	arrHeight[0] = l * 0.0933;
	arrHeight[1] = l * 0.0933;
	arrHeight[2] = l * 0.0421;

	makeBox(2, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);

	arrP[0].set(xCP - l * 0.16 / 2 - l * 0.0181 - l * 0.0933 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.0234 / 2,  dLongtube / 2);
	double diamsmall = l * 0.013;
	if( a * 0.009 < diamsmall )
		diamsmall = a * 0.009;
	makeSymbolicCircle(arrP[0], -vz, diamsmall);
	arrP[0].set(xCP - l * 0.16 / 2 - l * 0.0181 - l * 0.0933 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.0234 / 2, -dLongtube / 2);
	makeSymbolicCircle(arrP[0], -vz, diamsmall);

	double xCPb = xCP - l * 0.16 / 2 - l * 0.0181 - l * 0.0933 / 2;
	double yCPb = startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10;
	arrP[2].set(xCPb - l * 0.0933 / 2 * 0.8,  yCPb + a * 0.0234 * 0.2, dLongtube / 2);
	arrP[3].set(xCPb - l * 0.0933 / 2 * 0.8,  yCPb + a * 0.0234 * 0.5, dLongtube / 2);
	arrP[4].set(xCPb - l * 0.0421 / 2 * 1.0,  yCPb + a * 0.0234 * 0.8, dLongtube / 2);
	arrP[5].set(xCPb - l * 0.0421 / 2 * 0.6,  yCPb + a * 0.0234 * 0.8, dLongtube / 2);

	arrP[6].set(xCPb - l * 0.0421 / 2 * 0.6,  yCPb + a * 0.0234 * 0.7, dLongtube / 2);
	arrP[7].set(xCPb - l * 0.0933 / 2 * 0.45, yCPb + a * 0.0234 * 0.5, dLongtube / 2);
	arrP[8].set(xCPb - l * 0.0933 / 2 * 0.45, yCPb + a * 0.0234 * 0.2, dLongtube / 2);

	makeSymbolicLine(arrP[2], arrP[3]);
	makeSymbolicLine(arrP[3], arrP[4]);
	makeSymbolicLine(arrP[4], arrP[5]);
	makeSymbolicLine(arrP[5], arrP[6]);
	makeSymbolicLine(arrP[6], arrP[7]);
	makeSymbolicLine(arrP[7], arrP[8]);
	makeSymbolicLine(arrP[8], arrP[2]);

	arrP[2].set(xCPb + l * 0.0933 / 2 * 0.8,  yCPb + a * 0.0234 * 0.2, dLongtube / 2);
	arrP[3].set(xCPb + l * 0.0933 / 2 * 0.8,  yCPb + a * 0.0234 * 0.5, dLongtube / 2);
	arrP[4].set(xCPb + l * 0.0421 / 2 * 1.0,  yCPb + a * 0.0234 * 0.8, dLongtube / 2);
	arrP[5].set(xCPb + l * 0.0421 / 2 * 0.6,  yCPb + a * 0.0234 * 0.8, dLongtube / 2);

	arrP[6].set(xCPb + l * 0.0421 / 2 * 0.6,  yCPb + a * 0.0234 * 0.7, dLongtube / 2);
	arrP[7].set(xCPb + l * 0.0933 / 2 * 0.45, yCPb + a * 0.0234 * 0.5, dLongtube / 2);
	arrP[8].set(xCPb + l * 0.0933 / 2 * 0.45, yCPb + a * 0.0234 * 0.2, dLongtube / 2);

	makeSymbolicLine(arrP[2], arrP[3]);
	makeSymbolicLine(arrP[3], arrP[4]);
	makeSymbolicLine(arrP[4], arrP[5]);
	makeSymbolicLine(arrP[5], arrP[6]);
	makeSymbolicLine(arrP[6], arrP[7]);
	makeSymbolicLine(arrP[7], arrP[8]);
	makeSymbolicLine(arrP[8], arrP[2]);


	arrP[2].set(xCPb - l * 0.0933 / 2 * 0.8,  yCPb + a * 0.0234 * 0.2, -dLongtube / 2);
	arrP[3].set(xCPb - l * 0.0933 / 2 * 0.8,  yCPb + a * 0.0234 * 0.5, -dLongtube / 2);
	arrP[4].set(xCPb - l * 0.0421 / 2 * 1.0,  yCPb + a * 0.0234 * 0.8, -dLongtube / 2);
	arrP[5].set(xCPb - l * 0.0421 / 2 * 0.6,  yCPb + a * 0.0234 * 0.8, -dLongtube / 2);

	arrP[6].set(xCPb - l * 0.0421 / 2 * 0.6,  yCPb + a * 0.0234 * 0.7, -dLongtube / 2);
	arrP[7].set(xCPb - l * 0.0933 / 2 * 0.45, yCPb + a * 0.0234 * 0.5, -dLongtube / 2);
	arrP[8].set(xCPb - l * 0.0933 / 2 * 0.45, yCPb + a * 0.0234 * 0.2, -dLongtube / 2);

	makeSymbolicLine(arrP[2], arrP[3]);
	makeSymbolicLine(arrP[3], arrP[4]);
	makeSymbolicLine(arrP[4], arrP[5]);
	makeSymbolicLine(arrP[5], arrP[6]);
	makeSymbolicLine(arrP[6], arrP[7]);
	makeSymbolicLine(arrP[7], arrP[8]);
	makeSymbolicLine(arrP[8], arrP[2]);

	arrP[2].set(xCPb + l * 0.0933 / 2 * 0.8,  yCPb + a * 0.0234 * 0.2, -dLongtube / 2);
	arrP[3].set(xCPb + l * 0.0933 / 2 * 0.8,  yCPb + a * 0.0234 * 0.5, -dLongtube / 2);
	arrP[4].set(xCPb + l * 0.0421 / 2 * 1.0,  yCPb + a * 0.0234 * 0.8, -dLongtube / 2);
	arrP[5].set(xCPb + l * 0.0421 / 2 * 0.6,  yCPb + a * 0.0234 * 0.8, -dLongtube / 2);

	arrP[6].set(xCPb + l * 0.0421 / 2 * 0.6,  yCPb + a * 0.0234 * 0.7, -dLongtube / 2);
	arrP[7].set(xCPb + l * 0.0933 / 2 * 0.45, yCPb + a * 0.0234 * 0.5, -dLongtube / 2);
	arrP[8].set(xCPb + l * 0.0933 / 2 * 0.45, yCPb + a * 0.0234 * 0.2, -dLongtube / 2);

	makeSymbolicLine(arrP[2], arrP[3]);
	makeSymbolicLine(arrP[3], arrP[4]);
	makeSymbolicLine(arrP[4], arrP[5]);
	makeSymbolicLine(arrP[5], arrP[6]);
	makeSymbolicLine(arrP[6], arrP[7]);
	makeSymbolicLine(arrP[7], arrP[8]);
	makeSymbolicLine(arrP[8], arrP[2]);


	double xCP_2 = xCP + l * 0.16 / 2 + l * 0.287 / 2;
	double yCP = startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.1054 / 2;
	if( bGear_box == TRUE )
		{
		// накладка над круглым краном там где сверху болты

		// double xCP_2 = xCP + l * 0.16 / 2 + l * 0.287 / 2;
		// double yCP = startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.1054 / 2;
		arrP[0].set(xCP_2, yCP, -b / 2);
		arrP[1].set(xCP_2, yCP, -b / 2 + b * 0.0218);
		arrP[2].set(xCP_2, yCP, -b / 2 + b * 0.0218 + b * 0.319);
		arrP[3].set(xCP_2, yCP, -b / 2 + b * 0.0218 + b * 0.319 + b * 0.319 / 2 / 5  *  3);
		arrP[4].set(xCP_2, yCP, -b / 2 + b * 0.0218 + b * 0.319 + b * 0.319 / 2);

		arrP[5].set(xCP_2, yCP, -b / 2 + b * 0.0218 + b * 0.319 + b * 0.319 - b * 0.319 / 2 / 5  *  3);
		arrP[6].set(xCP_2, yCP, -b / 2 + b * 0.0218 + b * 0.319 + b * 0.319);

		arrP[7].set(xCP_2, yCP, -b / 2 + b * 0.0218 + b * 0.319 + b * 0.319 + b * 0.319);
		arrP[8].set(xCP_2, yCP, -b / 2 + b * 0.0218 + b * 0.319 + b * 0.319 + b * 0.319 + b * 0.0218);

		arrHeight[0] = arrHeight[1] = arrHeight[2] = arrHeight[3] = arrHeight[4] = arrHeight[5] = arrHeight[6] = arrHeight[7] = arrHeight[8] = a * 0.1054;

		arrWidth[0] = l * 0.1;
		arrWidth[1] = l * 0.1983;
		arrWidth[2] = l * 0.1983;
		arrWidth[3] = l * 0.287;
		arrWidth[4] = l * 0.287;
		arrWidth[5] = l * 0.287;
		arrWidth[6] = l * 0.1983;
		arrWidth[7] = l * 0.1983;
		arrWidth[8] = l * 0.1;

		arrV[0] = arrV[1] = arrV[2] = arrV[3] = arrV[4] = arrV[5] = arrV[6] = arrV[7] = arrV[8] = -vz;
		arrVu[0] = arrVu[1] = arrVu[2] = arrVu[3] = arrVu[4] = arrVu[5] = arrVu[6] = arrVu[7] = arrVu[8] = vy;

		makeBox(8, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);


		// болты сверху
		double dim = b * 0.0457;
		if( l * 0.031 < dim )
			dim = l * 0.031;

		arrP[0].set(xCP_2 - l * 0.0638, yCP + a * 0.1054 / 2 + a * 0.0132 / 2, -b * 0.436);
		makeDisc(arrP[0], vy, b * 0.0457, a * 0.0132, 2, true);

		arrP[0].set(xCP_2 + l * 0.0638, yCP + a * 0.1054 / 2 + a * 0.0132 / 2, -b * 0.436);
		makeDisc(arrP[0], vy, b * 0.0457, a * 0.0132, 2, true);

		arrP[0].set(xCP_2 - l * 0.0638, yCP + a * 0.1054 / 2 + a * 0.0132 / 2,  b * 0.436);
		makeDisc(arrP[0], vy, b * 0.0457, a * 0.0132, 2, true);

		arrP[0].set(xCP_2 + l * 0.0638, yCP + a * 0.1054 / 2 + a * 0.0132 / 2,  b * 0.436);
		makeDisc(arrP[0], vy, b * 0.0457, a * 0.0132, 2, true);
		}
	else
		{
		// круг от плоского крана
		double diam = l * 0.2361;
		if( b * 0.319 < diam )
			diam = b * 0.3;


		arrP[0].set(xCP + l * 0.16 / 2 + diam / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10,             0);
		arrP[1].set(xCP + l * 0.16 / 2 + diam / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064, 0);

		makeVerySimpleTube(arrP[0], arrP[1], diam, 5);
		makeFlatDisc(arrP[0], vy, diam, 5);
		makeFlatDisc(arrP[1], vy, diam, 5);


		// символы на крышке круга от плоского крана
		FdVector3d mvx0(-vx);
		double ranglArc = M_PI * 20 / 180.0;
		mvx0 = mvx0.rotateBy(ranglArc, vy);
		makeSymbolicArc(arrP[1], vy, mvx0, diam * 0.43, 140);
		makeSymbolicArc(arrP[1], vy, mvx0, diam * 0.35, 140);
		arrP[0].set(xCP + l * 0.16 / 2 + diam / 2 - diam * 0.39, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064, 0);
		arrP[0] = arrP[0].rotateBy(ranglArc, vy, arrP[1]);
		makeSymbolicArc(arrP[0], vy, -mvx0, diam * 0.04, 180);
		ranglArc = M_PI * 140 / 180.0;
		arrP[0] = arrP[0].rotateBy(ranglArc, vy, arrP[1]);
		mvx0 = mvx0.rotateBy(ranglArc, vy);
		makeSymbolicArc(arrP[0], vy, mvx0, diam * 0.04, 180);


		// продолжение символов
		FdVector3d mvx5(-vx);
		ranglArc = M_PI * 20 / 180.0;
		mvx5 = mvx5.rotateBy(ranglArc, vy);
		arrP[1].set(xCP + l * 0.16 / 2 + diam / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10, 0);
		makeSymbolicArc(arrP[1], vy, mvx5, diam * 0.43, 140);
		makeSymbolicArc(arrP[1], vy, mvx5, diam * 0.35, 140);
		arrP[0].set(xCP + l * 0.16 / 2 + diam / 2 - diam * 0.39, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10, 0);
		arrP[0] = arrP[0].rotateBy(ranglArc, vy, arrP[1]);
		makeSymbolicArc(arrP[0], vy, -mvx5, diam * 0.04, 180);
		ranglArc = M_PI * 140 / 180.0;
		arrP[0] = arrP[0].rotateBy(ranglArc, vy, arrP[1]);
		mvx5 = mvx5.rotateBy(ranglArc, vy);
		makeSymbolicArc(arrP[0], vy, mvx5, diam * 0.04, 180);

		arrP[1].set(xCP + l * 0.16 / 2 + diam / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064, 0);
		arrP[1].x -= diam * 0.39;
		makeSymbolicCircle(arrP[1], vy, diam * 0.08);
		arrP[1].x += diam * 0.78;
		makeSymbolicCircle(arrP[1], vy, diam * 0.08);
		arrP[1].y -= a*0.064;
		makeSymbolicCircle(arrP[1], vy, diam * 0.08);
		arrP[1].x -= diam * 0.78;
		makeSymbolicCircle(arrP[1], vy, diam * 0.08);


		// согнутый ограничитель на круге от плоского крана
		double sizeM = l * 0.00778;
		arrP[0].y += a * 0.064;
		arrP[1].set(arrP[0].x,                          arrP[0].y             + a * 0.0163, arrP[0].z);
		arrP[2].set(arrP[1].x + sizeM / 2 + l * 0.0067, arrP[1].y + sizeM / 2 + a * 0.0058, arrP[1].z);
		arrP[3].set(arrP[2].x             + l * 0.0543, arrP[2].y,                          arrP[2].z);

		arrWidth[0] = arrHeight[0] = arrWidth[1] = arrHeight[1] = arrWidth[2] = arrHeight[2] = arrWidth[3] = arrHeight[3] = sizeM;
		arrV[0] = arrV[1] = vy;
		arrV[2] = arrV[3] = vx;
		arrVu[0] = arrVu[1] = arrVu[2] = arrVu[3] = arrVu[4] = arrVu[5] = arrVu[6] = arrVu[7] = arrVu[8] = vz;

		makeBox(3, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);




		// ручка от плоского крана
		arrP[0].set(xCP + l * 0.14 / 2 + diam,                                       startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064 / 2,                          0);
		arrP[1].set(xCP + l * 0.14 / 2 + diam + l * 0.0704,                          startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064 / 2 + a * 0.011,              0);
		arrP[2].set(xCP + l * 0.14 / 2 + diam + l * 0.0704 + l * 0.0378,             startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064 / 2 + a * 0.011,              0);
		arrP[3].set(xCP + l * 0.14 / 2 + diam + l * 0.0704 + l * 0.0378 + l * 0.217, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064 / 2 + a * 0.011 + a * 0.0184, 0);

		arrV[0] = arrV[1] = arrV[2] = arrV[3] = -vx;
		arrVu[0] = arrVu[1] = arrVu[2] = arrVu[3] = vy;
		arrWidth[0] = arrWidth[1] = arrWidth[2] = arrWidth[3] = b * 0.0532;

		arrHeight[0] = a * 0.0263;
		arrHeight[1] = a * 0.0263;
		arrHeight[2] = a * 0.0263;
		arrHeight[3] = a * 0.00843;

		makeBox(3, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);
		};


	if( bGear_box == TRUE )
		{
		// круклый кран
		arrP[0].set(xCP_2 + l * 0.198 / 2,             startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064, b * 0.319);
		arrP[1].set(xCP_2 + l * 0.198 / 2 + l * 0.162, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064, b * 0.319);

		makeVerySimpleTube(arrP[0], arrP[1], b * 0.0478, 3);

		arrP[0].set(xCP_2 + l * 0.198 / 2 + l * 0.162,              startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064, b * 0.319);
		arrP[1].set(xCP_2 + l * 0.198 / 2 + l * 0.162 + l * 0.0539, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064, b * 0.319);

		makeVerySimpleTube(arrP[0], arrP[1], b * 0.085, 3);

		makeFlatDisc(arrP[0], -vx, b * 0.085, 3);
		makeFlatDisc(arrP[1],  vx, b * 0.085, 3);

		arrP[0].set(xCP_2 + l * 0.198 / 2 + l * 0.162 + l * 0.0539 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064, b * 0.319);

		makeTubularBend(arrP[0], vx, vy, b * 0.48, b * 0.0372, 360, 2, 10, true, false);


		// лучи для круглого крана от центра к ободу. 3 штуки через 120 градусов
		double xCP_3 = xCP_2 + l * 0.198 / 2 + l * 0.162 + l * 0.0539 / 2;
		double yCP_3 = startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064;

		arrP[0].set(xCP_3, yCP_3,            b * 0.319 + b * 0.085 / 2);
		arrP[1].set(xCP_3, yCP_3,            b * 0.319 + b * 0.085 / 2 + b * 0.48 / 4);
		arrP[2].set(xCP_3, yCP_3,            b * 0.319 + b * 0.085 / 2 + b * 0.48 / 4 * 2);
		arrP[3].set(xCP_3, yCP_3 - a * 0.01, b * 0.319 + b * 0.085 / 2 + b * 0.48 / 4 * 3);
		arrP[4].set(xCP_3, yCP_3 - a * 0.02, b * 0.319 + b * 0.48 - b * 0.0372 / 2);

		arrV[0] = arrV[1] = arrV[2] = arrV[3] = arrV[4] = -vz;
		arrVu[0] = arrVu[1] = arrVu[2] = arrVu[3] = arrVu[4] = vy;

		FdVector3d mvz1(-vz);
		double rangl10 = M_PI * 10 / 180.0;
		mvz1 = mvz1.rotateBy(rangl10, vx);

		FdVector3d mvz2(-vz);
		double rangl20 = M_PI * 20 / 180.0;
		mvz2 = mvz2.rotateBy(rangl20, vx);

		FdVector3d mvy1(vy);
		mvy1 = mvy1.rotateBy(rangl10, vx);

		FdVector3d mvy2(vy);
		mvy2 = mvy2.rotateBy(rangl20, vx);

		arrV[3] = arrV[3].rotateBy(rangl10, vx);
		arrV[4] = arrV[4].rotateBy(rangl20, vx);

		arrVu[3] = arrVu[3].rotateBy(rangl10, vx);
		arrVu[4] = arrVu[4].rotateBy(rangl20, vx);


		arrWidth[0] = b * 0.0372 / 2;
		arrWidth[1] = b * 0.0372 / 2 + b * 0.0372 / 10;
		arrWidth[2] = b * 0.0372 / 2 + b * 0.0372 / 5;
		arrWidth[3] = b * 0.0372 / 2 + b * 0.0372 / 10 * 3;
		arrWidth[4] = b * 0.0372 / 2 + b * 0.0372 / 10 * 3;

		arrHeight[0] = b * 0.0372 / 2;
		arrHeight[1] = b * 0.0372 / 2 + b * 0.0372 / 10;
		arrHeight[2] = b * 0.0372 / 2 + b * 0.0372 / 5;
		arrHeight[3] = b * 0.0372 / 2 + b * 0.0372 / 10 * 3;
		arrHeight[4] = b * 0.0372 / 2 + b * 0.0372 / 10 * 3;

		arrP[10].set(xCP_2 + l * 0.198 / 2 + l * 0.162 + l * 0.0539 / 2, startBox2 + a * 0.0527 + a * 0.2345 + a * 0.10 + a * 0.064, b * 0.319);


		double rangl30 = M_PI * -30 / 180.0;
		for( int i = 0; i < 5; i++ )
			{
			arrV[i] = arrV[i].rotateBy(rangl30, vx);
			arrVu[i] = arrVu[i].rotateBy(rangl30, vx);
			arrP[i].rotateBy(rangl30, vx, arrP[10]);
			};

		makeBox(4, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);


		double rangl = M_PI * 120 / 180.0;
		for( int i = 0; i < 5; i++ )
			{
			arrV[i] = arrV[i].rotateBy(rangl, vx);
			arrVu[i] = arrVu[i].rotateBy(rangl, vx);
			arrP[i].rotateBy(rangl, vx, arrP[10]);
			};

		makeBox(4, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);


		for( int i = 0; i < 5; i++ )
			{
			arrV[i] = arrV[i].rotateBy(rangl, vx);
			arrVu[i] = arrVu[i].rotateBy(rangl, vx);
			arrP[i].rotateBy(rangl, vx, arrP[10]);
			};

		makeBox(4, arrP, arrV, arrVu, arrWidth, arrHeight, arrSides, arrEdges, true, true, 0, 0, 0);
		};

	return 0;
	};

short CGeneralBlockCreator :: makeSABEAM()
	{
	postTransformMesh(ARX_PI / 2, FdVector3d::kXAxis);

	ads_real a, b, l;
	ads_real D, dn;
	ads_real heat;

	get_val("A", b);
	get_val("B", l);
	get_val("H", a);
	get_val("diam", D);
	get_val("_Cool", dn);
	get_val("_Heat", heat);

	FdPoint3d p1_n(0, a,     0),  // p1_n(-l / 2.0, -a / 20, b / 2),
	          p2_n(0, a / 6, 0),  // p2_n(-l / 2.0,  0,      b / 2),
	          p3_n(0, 0,     0);  // p3_n(-l / 2.0,  0,      b / 2);

	FdPoint3d cp_n[] = { p1_n, p2_n, p3_n };
	double tabWidth_n[] = { l, l, l };
	double tabHeight_n[] = { b, b, b - b * 0.24 };
	bool sides_n[] = { true, true, true, true,
	                   true, true, true, true };
	FdVector3d v_n[] = { -vy, -vy, -vy };
	FdVector3d vU_n[] = { vz, vz, vz };
	bool edges_n[][4] = { true, true,  true, true,
	                      true, true,  true, true,
	                      true, false, true, false,
	                      true, true,  true, true,
	                      true, true,  true, true };
	makeBox(2, cp_n, v_n, vU_n, tabWidth_n, tabHeight_n, sides_n, edges_n, true, true, 0, 0, 0);


	double ast = a * 0.67;
	double bst = b * 0.127;
	double cpc = a / 12 * 7;


	double size_m = D;
	double hm = size_m;
	// if( size_m > b )
	// 	size_m = b * 0.9;
	if( size_m > b - bst * 2 - dn * 2 )
		size_m = b - bst * 2 - dn * 2;
	if( size_m > a / 12 * 9 )
		size_m = a / 12 * 9;


	// cp_n[0].set(-l / 2, a / 4 * 3 / 2 + a / 4, 0);
	cp_n[0].set(-l / 2,       cpc, 0);
	cp_n[1].set(-l / 2 - 100, cpc, 0);
	// makeVerySimpleTube(cp_n, size_m * 0.75, 5);
	makeVerySimpleTube(cp_n, size_m, 5);

	int n_n = 5;  // 50;
	double r_n = size_m / 2 * 1.006;
	// p1_n.set(-l / 2 - 100 - a * 0.00475 - a * 0.0672, cpc, 0);
	p1_n.set(-l / 2 - 100 - a * 0.00475, cpc, 0);
	double latAngles_n[2] = { 88.89, 91.09 };  // { 88.8, 90.9 }  // { lowerTheta, 180 - upperTheta }
	double longAngles_n[2] = { 0, 360 };
	double diams_n[3] = { r_n * 0.3, r_n * 2, r_n * 2 };
	int complexities_n[2] = { max(1, n_n / 2), 4 * n_n };
	makeSpheroidSection(p1_n, vx, latAngles_n, longAngles_n, diams_n, complexities_n);

	// cp_n[0].set(-l / 2, a / 4 * 3 / 2 + a / 4, 0);
	cp_n[0].set(-l / 2 - 100 - a * 0.00475 * 2,      cpc, 0);
	cp_n[1].set(-l / 2 - 100 - a * 0.00475 * 2 - 30, cpc, 0);
	// makeVerySimpleTube(cp_n, size_m * 0.75, 5);
	makeVerySimpleTube(cp_n, size_m, 5);

	p1_n.set(-l / 2 - 100 - a * 0.00475 * 2 - 30 - a * 0.00475, cpc, 0);
	makeSpheroidSection(p1_n, vx, latAngles_n, longAngles_n, diams_n, complexities_n);

	double bn = b * 0.0526;
	double bs = b * 0.0947;
	double b2r = bs + bn + b * 0.0316 + bn / 2;


	p1_n.set(0, a, -b / 2 + bs);
	makeAssemblyHole(p1_n, -vy, vx, l - l * 0.0275 * 2, bn);
	p1_n.set(0, a, -b / 2 + b2r);
	makeAssemblyHole(p1_n, -vy, vx, l - l * 0.0275 * 2, bn);

	p1_n.set(0, a,  b / 2 - bs);
	makeAssemblyHole(p1_n, -vy, vx, l - l * 0.0275 * 2, bn);
	p1_n.set(0, a,  b / 2 - b2r);
	makeAssemblyHole(p1_n, -vy, vx, l - l * 0.0275 * 2, bn);


	// where 11 = 1 / 11 * 1200
	double xst = -l / 2 + l * 0.0818 + 11 / 2;
	while( xst <  l / 2 - l * 0.0818 - 11 / 2 )
		{
		p1_n.set(xst, a * 0.59,  b / 2);
		makeAssemblyHole(p1_n, -vz, vy, a * 0.273, 11);
		p1_n.set(xst, a * 0.59, -b / 2);
		makeAssemblyHole(p1_n, -vz, vy, a * 0.273, 11);
		xst += 11 + 6.3;
		};

	double st = a * 0.59;
	p1_n.set(l / 2 - l * 0.028, st, 0);
	makeSymbolicCircle(p1_n, -vx, size_m);
	makeSymbolicCircle(p1_n, -vx, size_m - size_m / 20);

	p1_n.set(-l / 2, st, 0);
	makeSymbolicCircle(p1_n, -vx, size_m);
	makeSymbolicCircle(p1_n, -vx, size_m - size_m / 20);

	p1_n.set(-l / 2,             st + size_m / 2, 0);
	p2_n.set( l / 2 - l * 0.028, st + size_m / 2, 0);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,             st + size_m / 2 - size_m / 40, 0);
	p2_n.set( l / 2 - l * 0.028, st + size_m / 2 - size_m / 40, 0);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,             st, size_m / 2);
	p2_n.set( l / 2 - l * 0.028, st, size_m / 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,             st, size_m / 2 - size_m / 40);
	p2_n.set( l / 2 - l * 0.028, st, size_m / 2 - size_m / 40);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,             st, -size_m  / 2);
	p2_n.set( l / 2 - l * 0.028, st, -size_m  / 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,             st, -size_m / 2 + size_m / 40);
	p2_n.set( l / 2 - l * 0.028, st, -size_m / 2 + size_m / 40);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,             st - size_m  / 2, 0);
	p2_n.set( l / 2 - l * 0.028, st - size_m  / 2, 0);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,             st - size_m / 2 + size_m / 40, 0);
	p2_n.set( l / 2 - l * 0.028, st - size_m / 2 + size_m / 40, 0);
	makeSymbolicLine(p1_n, p2_n);




	cp_n[0].set(-l / 2,       ast,  b / 2 - bst);
	cp_n[1].set(-l / 2 - 100, ast,  b / 2 - bst);
	makeVerySimpleTube(cp_n, dn, 5);

	cp_n[0].set(-l / 2,       ast, -b / 2 + bst);
	cp_n[1].set(-l / 2 - 100, ast, -b / 2 + bst);
	makeVerySimpleTube(cp_n, dn, 5);

	p1_n.set(-l / 2, ast, b / 2 - bst);
	makeSymbolicCircle(p1_n, -vx, dn);
	makeSymbolicCircle(p1_n, -vx, dn - dn / 10);

	p1_n.set(-l / 2, ast, -b / 2 + bst);
	makeSymbolicCircle(p1_n, -vx, dn);
	makeSymbolicCircle(p1_n, -vx, dn - dn / 10);

	p1_n.set(l / 2 - l * 0.0275, ast,  b / 2 - bst);
	makeSymbolicCircle(p1_n, -vx, dn);
	makeSymbolicCircle(p1_n, -vx, dn - dn / 10);

	p1_n.set(l / 2 - l * 0.0275, ast, -b / 2 + bst);
	makeSymbolicCircle(p1_n, -vx, dn);
	makeSymbolicCircle(p1_n, -vx, dn - dn / 10);




	p1_n.set(-l / 2,              ast + dn / 2, b / 2 - bst);
	p2_n.set( l / 2 - l * 0.0275, ast + dn / 2, b / 2 - bst);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast + dn / 2 - dn / 20, b / 2 - bst);
	p2_n.set( l / 2 - l * 0.0275, ast + dn / 2 - dn / 20, b / 2 - bst);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast - dn / 2, b / 2 - bst);
	p2_n.set( l / 2 - l * 0.0275, ast - dn / 2, b / 2 - bst);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast - dn / 2 + dn / 20, b / 2 - bst);
	p2_n.set( l / 2 - l * 0.0275, ast - dn / 2 + dn / 20, b / 2 - bst);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast, b / 2 - bst - dn / 2);
	p2_n.set( l / 2 - l * 0.0275, ast, b / 2 - bst - dn / 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast, b / 2 - bst - dn / 2 + dn / 20);
	p2_n.set( l / 2 - l * 0.0275, ast, b / 2 - bst - dn / 2 + dn / 20);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast, b / 2 - bst + dn / 2);
	p2_n.set( l / 2 - l * 0.0275, ast, b / 2 - bst + dn / 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast, b / 2 - bst + dn / 2 - dn / 20);
	p2_n.set( l / 2 - l * 0.0275, ast, b / 2 - bst + dn / 2 - dn / 20);
	makeSymbolicLine(p1_n, p2_n);




	p1_n.set(-l / 2,              ast + dn / 2, -b / 2 + bst);
	p2_n.set( l / 2 - l * 0.0275, ast + dn / 2, -b / 2 + bst);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast + dn / 2 - dn / 20, -b / 2 + bst);
	p2_n.set( l / 2 - l * 0.0275, ast + dn / 2 - dn / 20, -b / 2 + bst);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast - dn / 2, -b / 2 + bst);
	p2_n.set( l / 2 - l * 0.0275, ast - dn / 2, -b / 2 + bst);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast - dn / 2 + dn / 20, -b / 2 + bst);
	p2_n.set( l / 2 - l * 0.0275, ast - dn / 2 + dn / 20, -b / 2 + bst);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast, -b / 2 + bst - dn / 2);
	p2_n.set( l / 2 - l * 0.0275, ast, -b / 2 + bst - dn / 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast, -b / 2 + bst - dn / 2 + dn / 20);
	p2_n.set( l / 2 - l * 0.0275, ast, -b / 2 + bst - dn / 2 + dn / 20);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast, -b / 2 + bst + dn / 2);
	p2_n.set( l / 2 - l * 0.0275, ast, -b / 2 + bst + dn / 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(-l / 2,              ast, -b / 2 + bst + dn / 2 - dn / 20);
	p2_n.set( l / 2 - l * 0.0275, ast, -b / 2 + bst + dn / 2 - dn / 20);
	makeSymbolicLine(p1_n, p2_n);


	ast = a * 0.32;
	bst = b * 0.182;
	if( heat > 0 )
		{
		p1_n.set(-l / 2, ast,  b / 2 - bst);
		makeSymbolicCircle(p1_n, -vx, heat);

		p1_n.set(-l / 2, ast, -b / 2 + bst);
		makeSymbolicCircle(p1_n, -vx, heat);
		};

	return 0;
	};

short CGeneralBlockCreator :: make3WSABEAM()
	{
	postTransformMesh(ARX_PI / 2, FdVector3d::kXAxis);

	ads_real a, b, l;
	ads_real D, dn;
	ads_real heat;

	get_val("A", b);
	get_val("B", l);
	get_val("H", a);
	get_val("diam", D);
	get_val("_Cool", dn);
	get_val("_Heat", heat);

	// D = 200;
	// dn = 50;

	double l06 = l * 0.6;
	double a3 = (a - a / 20) / 3;
	double a32 = a3 * 2;
	double a34 = a32 * 2;
	double dK = 1;

	if( b / a < 2 )
		{
		dK = b / a;
		a32 *= dK / 2;
		a34 *= dK / 2;
		};

	double b2 = b / 2;
	double b20 = b / 20;
	double ba32 = b - b20 - a32;
	double ba34 = b - b20 - a34;


	double lMax = l * 0.99;
	FdPoint3d p1_n(l / 2 - lMax       / 2, 0,                0),  // p1_n(-l / 2.0,       -a / 20,        b / 2),
	          p2_n(l / 2 - lMax       / 2, a / 20,           0),  // p2_n(-l / 2.0,        0,             b / 2),
	          p3_n(l / 2 - lMax       / 2, a / 20,           0),  // p3_n(-l / 2.0,        0,             b / 2),
	          p4_n(l / 2 - lMax       / 2, a / 20 + a3,      0),  // p4_n(-l / 2.0,        a / 3,         b / 2),
	          p5_n(l / 2 - lMax * 0.6 / 2, a / 20 + a3,      0),  // p5_n(-l * 0.6 / 2.0,  a / 3,         b / 2),
	          p6_n(l / 2 - lMax * 0.6 / 2, a / 20 + a3 + a3, 0),  // p6_n(-l * 0.6 / 2.0,  a / 3 + a / 3, b / 2),
	          p7_n(l / 2 - lMax * 0.6 / 2, a,                0);  // p7_n(-l * 0.6 / 2.0,  a,             b / 2);
	FdPoint3d cp_n[] = { p1_n, p2_n, p3_n, p4_n, p5_n, p6_n, p7_n };
	double tabWidth_n[] = { lMax, lMax, lMax, lMax, lMax * 0.6, lMax * 0.6, lMax * 0.6 };
	double tabHeight_n[] = { b, b, b - b20, ba32, ba32, ba34, ba34 };
	bool sides_n[] = { true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true,
	                   true, true, true, true };
	FdVector3d v_n[] = { vy, vy, vy, vy, vy, vy, vy };
	FdVector3d vU_n[] = { vz, vz, vz, vz, vz, vz, vz };
	bool edges_n[][4] = { true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true,
	                      true, true, true, true };

	makeBox(6, cp_n, v_n, vU_n, tabWidth_n, tabHeight_n, sides_n, edges_n, true, true, 0, 0, 0);


	cp_n[0].set(l / 2 - lMax * 0.6 - (lMax * 0.4 - lMax * 0.05) / 2, a / 20 + a3, 0);
	cp_n[1].set(l / 2 - lMax * 0.6 - (lMax * 0.4 - lMax * 0.05) / 2, a - a / 20,  0);
	cp_n[2].set(l / 2 - lMax * 0.6 - (lMax * 0.4 - lMax * 0.05) / 2, a,           0);
	tabHeight_n[0] = tabHeight_n[1] = tabHeight_n[2] = ba34;
	tabWidth_n[0] = tabWidth_n[1] = tabWidth_n[2] = lMax * 0.4 - lMax * 0.05;

	makeBox(2, cp_n, v_n, vU_n, tabWidth_n, tabHeight_n, sides_n, edges_n, true, true, 0, 0, 0);


	double diam_midl = dn;
	// if( diam_midl > lMax * 0.05 / 4 )
	// 	diam_midl = lMax * 0.05 / 4;
	// if( lMax * 0.05 > ba32 / 4 )
	// 	diam_midl *= 1 - lMax * 0.05 / ba32;

	double diam_m = D * 1.333;  // ba34
	// if( a3 * 2 - a / 20 < ba34 )
	// 	diam_m = a3 * 2 - a / 20;
	if( diam_m > ba34 - diam_midl * 4 )
		diam_m = ba34 - diam_midl * 4;
	if( diam_m > a3 )
		diam_m = a3;


	cp_n[0].set(-l / 2 + lMax * 0.06, a / 20 + a3 + (a3 + a3) / 2, 0);
	cp_n[1].set(-l / 2 + lMax * 0.02, a / 20 + a3 + (a3 + a3) / 2, 0);
	makeVerySimpleTube(cp_n, diam_m * 0.75, 5);

	double dKoef1 = lMax * 0.002 * 0.85;
	double dKoef2 = lMax * 0.002 * 0.99;
	p1_n.set(-l / 2 + lMax * 0.01 + lMax * 0.01  /* - diam_m * 0.08 */, a / 20 + a3 + (a3 + a3) / 2, 0);
	p2_n.set(-l / 2 + lMax * 0.01 + lMax * 0.008 /* - diam_m * 0.08 */, a / 20 + a3 + (a3 + a3) / 2, 0);
	makeSimpleTube(p1_n, p2_n, diam_m * 0.75, diam_m * 0.75 - dKoef1, 5);

	p1_n.set(-l / 2 + lMax * 0.01 + lMax * 0.008 /* - diam_m * 0.08 */, a / 20 + a3 + (a3 + a3) / 2, 0);
	p2_n.set(-l / 2 + lMax * 0.01 + lMax * 0.006 /* - diam_m * 0.08 */, a / 20 + a3 + (a3 + a3) / 2, 0);
	makeSimpleTube(p1_n, p2_n, diam_m * 0.75 - dKoef1, diam_m * 0.75 - dKoef2, 5);

	p1_n.set(-l / 2 + lMax * 0.01 + lMax * 0.006 /* - diam_m * 0.08 */, a / 20 + a3 + (a3 + a3) / 2, 0);
	p2_n.set(-l / 2 + lMax * 0.01 + lMax * 0.004 /* - diam_m * 0.08 */, a / 20 + a3 + (a3 + a3) / 2, 0);
	makeSimpleTube(p1_n, p2_n, diam_m * 0.75 - dKoef2, diam_m * 0.75 - dKoef2, 5);

	p1_n.set(-l / 2 + lMax * 0.01 + lMax * 0.004 /* - diam_m * 0.08 */, a / 20 + a3 + (a3 + a3) / 2, 0);
	p2_n.set(-l / 2 + lMax * 0.01 + lMax * 0.002 /* - diam_m * 0.08 */, a / 20 + a3 + (a3 + a3) / 2, 0);
	makeSimpleTube(p1_n, p2_n, diam_m * 0.75 - dKoef2, diam_m * 0.75 - dKoef1, 5);

	p1_n.set(-l / 2 + lMax * 0.01 + lMax * 0.000 /* - diam_m * 0.08 */, a / 20 + a3 + (a3 + a3) / 2, 0);
	p2_n.set(-l / 2 + lMax * 0.01 + lMax * 0.002 /* - diam_m * 0.08 */, a / 20 + a3 + (a3 + a3) / 2, 0);
	makeSimpleTube(p1_n, p2_n, diam_m * 0.75, diam_m * 0.75 - dKoef1, 5);

	int n_n = 5;  // 50;
	double r_n = diam_m / 2 * 0.756;
	p1_n.set(-l / 2 + lMax * 0.01 - diam_m * 0.007, a / 20 + a3 + (a3 + a3) / 2, 0);
	double latAngles_n[2] = { 88.89, 91.09 };  // { 88.8, 90.9 }  // { lowerTheta, 180 - upperTheta }
	double longAngles_n[2] = { 0, 360 };
	double diams_n[3] = { r_n * 0.3, r_n * 2, r_n * 2 };
	int complexities_n[2] = { max(1, n_n / 2), 4 * n_n };
	makeSpheroidSection(p1_n, vx, latAngles_n, longAngles_n, diams_n, complexities_n);


	// make connecting tube (this is not drawn by 'makeRectToTubeTransition()' due to shading issues)
	cp_n[0].set(l / 2 - lMax + lMax * 0.05 / 2,      a3 / 2 + a / 20,  ba34 / 2 - diam_midl * 1.5 / 2);
	cp_n[1].set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 2 + a / 20,  ba34 / 2 - diam_midl * 1.5 / 2);
	makeVerySimpleTube(cp_n, diam_midl, 5);

	cp_n[0].set(l / 2 - lMax + lMax * 0.05 / 2,      a3 / 2 + a / 20, -ba34 / 2 + diam_midl * 1.5 / 2);
	cp_n[1].set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 2 + a / 20, -ba34 / 2 + diam_midl * 1.5 / 2);
	makeVerySimpleTube(cp_n, diam_midl, 5);

	if( heat > 0 )
		{
		cp_n[0].set(l / 2 - lMax + lMax * 0.05 / 2,      a3 / 2 + a / 20,  ba34 / 2 - diam_midl * 1.5 - heat * 1.5 / 2);
		cp_n[1].set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 4 + a / 20,  ba34 / 2 - diam_midl * 1.5 - heat * 1.5 / 2);
		makeVerySimpleTube(cp_n, heat, 5);

		cp_n[0].set(l / 2 - lMax + lMax * 0.05 / 2,      a3 / 2 + a / 20, -ba34 / 2 + diam_midl * 1.5 + heat * 1.5 / 2);
		cp_n[1].set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 4 + a / 20, -ba34 / 2 + diam_midl * 1.5 + heat * 1.5 / 2);
		makeVerySimpleTube(cp_n, heat, 5);
		};


	n_n = 5;  // 50
	r_n = diam_midl / 2 * 1.07;
	p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 2 + a / 20 + r_n * 0.34, ba34 / 2 - diam_midl * 1.5 / 2);
	// p1_n.set(-l / 2 + l * 0.05 / 2, a3 + a3 / 2 + r_n * 0.34, -b / 2 + a32 + l * 0.05 / 2);
	latAngles_n[0] = 70.0;
	latAngles_n[1] = 110.00;  // { 88.8, 90.9 }  // { lowerTheta, 180 - upperTheta }
	longAngles_n[0] = 0;
	longAngles_n[1] = 360;
	diams_n[0] = r_n * 2;
	diams_n[1] = diams_n[2] = r_n * 2;
	complexities_n[0] = max(1, n_n / 2);
	complexities_n[1] = 2 * n_n;  // 4 * n_n
	makeSpheroidSection(p1_n, vy, latAngles_n, longAngles_n, diams_n, complexities_n);

	p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 2 + a / 20 + r_n * 1.02, ba34 / 2 - diam_midl * 1.5 / 2);
	// p1_n.set(-l / 2 + l * 0.05 / 2, a3 + a3 / 2 + r_n * 1.02, -b / 2 + a32 + l * 0.05 / 2);
	makeSpheroidSection(p1_n, vy, latAngles_n, longAngles_n, diams_n, complexities_n);


	p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 2 + a / 20 + r_n * 0.34, -ba34 / 2 + diam_midl * 1.5 / 2);
	makeSpheroidSection(p1_n, vy, latAngles_n, longAngles_n, diams_n, complexities_n);

	p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 2 + a / 20 + r_n * 1.02, -ba34 / 2 + diam_midl * 1.5 / 2);
	makeSpheroidSection(p1_n, vy, latAngles_n, longAngles_n, diams_n, complexities_n);

	if( heat > 0 )
		{
		r_n = heat / 2 * 1.07;
		diams_n[0] = r_n * 2;
		diams_n[1] = diams_n[2] = r_n * 2;
		p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 4 + a / 20 + r_n * 0.34,  ba34 / 2 - diam_midl * 1.5 - heat * 1.5 / 2);
		makeSpheroidSection(p1_n, vy, latAngles_n, longAngles_n, diams_n, complexities_n);

		p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 4 + a / 20 + r_n * 1.02,  ba34 / 2 - diam_midl * 1.5 - heat * 1.5 / 2);
		makeSpheroidSection(p1_n, vy, latAngles_n, longAngles_n, diams_n, complexities_n);

		p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 4 + a / 20 + r_n * 0.34, -ba34 / 2 + diam_midl * 1.5 + heat * 1.5 / 2);
		makeSpheroidSection(p1_n, vy, latAngles_n, longAngles_n, diams_n, complexities_n);

		p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a3 / 4 + a / 20 + r_n * 1.02, -ba34 / 2 + diam_midl * 1.5 + heat * 1.5 / 2);
		makeSpheroidSection(p1_n, vy, latAngles_n, longAngles_n, diams_n, complexities_n);
		};


	double diam = ba34 / 10;
	if( ba34 > lMax * 0.4 - lMax * 0.05 )
		diam = (lMax * 0.4 - lMax * 0.05) / 10;
	double thickness = diam / 4;
	double diamadd = diam / 30;
	p1_n.set(l / 2 - lMax + lMax * 0.055 + diam + diamadd, a + thickness / 2, -ba34 / 2 + diam + diamadd);
	makeDisc(p1_n, vy, diam, thickness, 2, true);

	p1_n.set(l / 2 - lMax + lMax * 0.055 + diam + diamadd, a + thickness / 2,  ba34 / 2 - diam - diamadd);
	makeDisc(p1_n, vy, diam, thickness, 2, true);

	p1_n.set(l / 2 - lMax * 0.6 - diam - diamadd, a + thickness / 2, -ba34 / 2 + diam + diamadd);
	makeDisc(p1_n, vy, diam, thickness, 2, true);

	p1_n.set(l / 2 - lMax * 0.6 - diam - diamadd, a + thickness / 2,  ba34 / 2 - diam - diamadd);
	makeDisc(p1_n, vy, diam, thickness, 2, true);


	diam = a3 / 10;
	if( diam > lMax * 0.6 )
		diam = lMax * 0.6 / 10;
	thickness = diam / 4;
	diamadd = diam / 30;
	double xadd = lMax * 0.6 / 2 - diam + diamadd;
	for( int i = 0; i < 3; i++ )
		{
		p1_n.set(l / 2 - diam - diamadd - xadd * i, a      - diam - diamadd, -ba34 / 2 - thickness / 2);
		makeDisc(p1_n, -vz, diam, thickness, 2, true);

		p1_n.set(l / 2 - diam - diamadd - xadd * i, a - a3 + diam + diamadd, -ba34 / 2 - thickness / 2);
		makeDisc(p1_n, -vz, diam, thickness, 2, true);

		p1_n.set(l / 2 - diam - diamadd - xadd * i, a      - diam - diamadd,  ba34 / 2 + thickness / 2);
		makeDisc(p1_n, vz, diam, thickness, 2, true);

		p1_n.set(l / 2 - diam - diamadd - xadd * i, a - a3 + diam + diamadd,  ba34 / 2 + thickness / 2);
		makeDisc(p1_n, vz, diam, thickness, 2, true);
		};


	p1_n.set(l / 2 - lMax + lMax * 0.05, a - a / 20, -ba34 / 2);
	p2_n.set(l / 2 - lMax + lMax * 0.05, a - a / 20,  ba34 / 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6, a - a / 20, ba34 / 2);
	makeSymbolicLine(p2_n, p1_n);

	p2_n.set(l / 2 - lMax * 0.6, a - a3, ba34 / 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2, a - a3, ba34 / 2);
	makeSymbolicLine(p2_n, p1_n);

	p2_n.set(l / 2, a - a3, -ba34 / 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6, a - a3, -ba34 / 2);
	makeSymbolicLine(p2_n, p1_n);

	p2_n.set(l / 2 - lMax * 0.6, a - a / 20, -ba34 / 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax + lMax * 0.05, a - a / 20, -ba34 / 2);
	makeSymbolicLine(p2_n, p1_n);


	double kk = (ba32 - ba34) / 2 / a3;
	p1_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 / kk, -ba32 / 2 + (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 / kk, -ba32 / 2 + (ba32 - ba34) / 8);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 / kk, -ba32 / 2 + (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 / kk, -ba32 / 2 + (ba32 - ba34) / 8);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, -ba32 / 2 + (ba32 - ba34) / 8 * 2);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, -ba32 / 2 + (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, -ba32 / 2 + (ba32 - ba34) / 8 * 2);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, -ba32 / 2 + (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);


	p1_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8     / kk, -ba32 / 2 + (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, -ba32 / 2 + (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8     / kk, -ba32 / 2 + (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, -ba32 / 2 + (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8     / kk, -ba32 / 2 + (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, -ba32 / 2 + (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8     / kk, -ba32 / 2 + (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, -ba32 / 2 + (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);


	p1_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 / kk, ba32 / 2 - (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 / kk, ba32 / 2 - (ba32 - ba34) / 8);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 / kk, ba32 / 2 - (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 / kk, ba32 / 2 - (ba32 - ba34) / 8);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, ba32 / 2 - (ba32 - ba34) / 8 * 2);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, ba32 / 2 - (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, ba32 / 2 - (ba32 - ba34) / 8 * 2);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, ba32 / 2 - (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);


	p1_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8     / kk, ba32 / 2 - (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, ba32 / 2 - (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8     / kk, ba32 / 2 - (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 1 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, ba32 / 2 - (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8     / kk, ba32 / 2 - (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 0, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, ba32 / 2 - (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);

	p1_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8     / kk, ba32 / 2 - (ba32 - ba34) / 8);
	p2_n.set(l / 2 - lMax * 0.6 / 7 * 4 - lMax * 0.6 / 7 * 2, a3 + a / 20 + (ba32 - ba34) / 8 * 2 / kk, ba32 / 2 - (ba32 - ba34) / 8 * 2);
	makeSymbolicLine(p1_n, p2_n);


	p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a / 20,  ba34 / 2 - diam_midl * 1.5 / 2);
	makeSymbolicCircle(p1_n, vy, diam_midl * 1.4);
	p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a / 20, -ba34 / 2 + diam_midl * 1.5 / 2);
	makeSymbolicCircle(p1_n, vy, diam_midl * 1.4);

	p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a / 20,  ba34 / 2 - diam_midl * 1.5 - heat * 1.5 / 2);
	makeSymbolicCircle(p1_n, vy, heat * 1.4);
	p1_n.set(l / 2 - lMax + lMax * 0.05 / 2, a3 + a / 20, -ba34 / 2 + diam_midl * 1.5 + heat * 1.5 / 2);
	makeSymbolicCircle(p1_n, vy, heat * 1.4);

	p1_n.set(-l / 2 + lMax * 0.06, a / 20 + a3 + (a3 + a3) / 2, 0);
	makeSymbolicCircle(p1_n, -vx, diam_m * 0.75);

	return 0; 
	};










short CGeneralBlockCreator::makeHDPECP()
{
	ads_real DE, H, F, B, C, A;

	get_val("DE", DE);
	get_val("H", H);
	get_val("F", F);
	get_val("B", B);
	get_val("C", C);
	get_val("A", A);

	FdPoint3d cp1(0,0,0), cp2(H, 0, 0), cp3(H+F,0,0), cp4(H+F+A, 0,0);
	FdPoint3d cp[7] = { cp1, cp2, cp2, cp3, cp3, cp3, cp4 };
	double diams[7] = { DE, DE, DE, H, H, C, C };
	makeStraightTube(cp, diams, 10, 6, true);

	return 0;
}
short CGeneralBlockCreator::makeHDPERP()
{
ads_real DE, DE1, H, H1, Z, Z_geo;

	get_val("DE", DE);
	get_val("DE1", DE1);
	get_val("H", H);
	get_val("H1", H1);
	get_val("Z", Z);
	get_val("Z_geo", Z_geo);

	FdPoint3d cp1(0,0,0), cp2(H, 0, 0), cp3(H+Z_geo,0,0), cp4(H+Z_geo+H1, 0,0);
	FdPoint3d cp[7] = { cp1, cp2, cp2, cp3, cp3, cp3, cp4 };
	double diams[7] = { DE, DE, DE, DE1, DE1, DE1, DE1 };
	makeStraightTube(cp, diams, 10, 6, true);

	return 0;
}
short CGeneralBlockCreator::makeTRPPFV()
{
ads_real D, A, B, C;
	
	get_val("D", D);
	get_val("A", A);
	get_val("B", B);
	get_val("C", C);

	FdPoint3d cp1(0, 0, 0);
	double mainTubePar[3] = { D, D, A };
	double interTubePos[2] = { A / 2, 0 };
	double interTubePar[3] = { B - D / 2, D, D };
	double ang[3] = { 90, 90, 0 };
	int n[2] = { 10, 10 };
	bool options[3] = { false, false, false };

	makeTubeToTubeIntersection(cp1, vx, mainTubePar, interTubePos, interTubePar, ang, n, options);

	return 0;
}
short CGeneralBlockCreator::makeTP90()
{
ads_real DE, H, Z;
	
	get_val("DE", DE);
	get_val("H", H);
	get_val("Z", Z);

	FdPoint3d cp1(0, 0, 0);
	double mainTubePar[3] = { DE, DE, Z };
	double interTubePos[2] = { Z / 2, 0 };
	double interTubePar[3] = { H + DE / 2, DE, DE };
	double ang[3] = { 90, 90, 0 };
	int n[2] = { 10, 10 };
	bool options[3] = { false, false, false };

	makeTubeToTubeIntersection(cp1, vx, mainTubePar, interTubePos, interTubePar, ang, n, options);

	return 0;
}
short CGeneralBlockCreator::makeTRP90()
{
ads_real DE, DE1, H, H1, Z;
	
	get_val("DE", DE);
	get_val("DE1", DE1);
	get_val("H", H);
	get_val("H1", H1);
	get_val("Z", Z);

	FdPoint3d cp1(0, 0, 0);
	double mainTubePar[3] = { DE, DE, Z };
	double interTubePos[2] = { Z / 2, 0 };
	double interTubePar[3] = { H1 + DE / 2, DE1, DE1 };
	double ang[3] = { 90, 90, 0 };
	int n[2] = { 10, 10 };
	bool options[3] = { false, false, false };

	makeTubeToTubeIntersection(cp1, vx, mainTubePar, interTubePos, interTubePar, ang, n, options);

	return 0;
}
short CGeneralBlockCreator::make51N()
{
ads_real d, A, D, C;

	get_val("d", d);
	get_val("A", A);
	get_val("D", D);
	get_val("C", C);

	FdPoint3d cp1(0, 0, 0);
	double mainTubePar[3] = { d, d, A };
	double interTubePos[2] = { A / 2, 0 };
	double interTubePar[3] = { D + d / 2, C, C };
	double ang[3] = { 90, 90, 0 };
	int n[2] = { 10, 10 };
	bool options[3] = { false, false, false };

	makeTubeToTubeIntersection(cp1, vx, mainTubePar, interTubePos, interTubePar, ang, n, options);

	return 0;
}
short CGeneralBlockCreator::makeKOL()
{
	ads_real dext1, dint, r, alfa, DU_int, l1_kiel, l2_kiel, l3_kiel, l4_kiel, d1_k_ext, DU_ext, z1;

	get_val("dext1", dext1);
	get_val("dint", dint);
	get_val("r", r);
	get_val("alfa", alfa);
	get_val("DU_int", DU_int);

	get_val("l1_kiel", l1_kiel);
	get_val("l2_kiel", l2_kiel);
	get_val("l3_kiel", l3_kiel);
	get_val("l4_kiel", l4_kiel);
	get_val("d1_k_ext", d1_k_ext);
	get_val("DU_ext", DU_ext);
	get_val("z1", z1);

	FdPoint3d p(0, 0, 0);

	r = 0.5 * dext1;

	makeDonutSection(p, vz, vy, r, dext1, alfa, 10, 10);
	makeDonutSection(p, vz, vy, r, DU_int, alfa, 10, 10);

	double alfa_r = alfa * ARX_PI / 180;
	p.set(0, dext1 / 2, 0);
	// FdPoint3d pp(dext, dext / 2, 0);
	// FdPoint3d ppp[2] = { p.rotateBy(alfa_r, vz), pp.rotateBy(alfa_r, vz) };
	// makeVerySimpleTube(ppp, dext, 10);

	// ______________________________________________________

	FdPoint3d p1( - l1_kiel, dext1 / 2, 0), p2( - l1_kiel - l2_kiel, dext1 / 2, 0), p3( - l1_kiel - l2_kiel - l3_kiel, dext1 / 2, 0), p4( - l1_kiel - l2_kiel - l3_kiel - l4_kiel, dext1 / 2, 0);

	FdPoint3d CPKiel[8] = { p.rotateBy(alfa_r, vz), p1.rotateBy(alfa_r, vz), p1, p2.rotateBy(alfa_r, vz), p2, p3.rotateBy(alfa_r, vz), p3, p4.rotateBy(alfa_r, vz) };
	double diams_k_1[8] = { dext1, d1_k_ext, d1_k_ext, d1_k_ext, DU_ext, DU_ext, d1_k_ext, d1_k_ext };       
	double diams_k_2[8] = { dext1, dext1, dext1, dext1, DU_int, DU_int, dext1, dext1 };
	int n = 20;
	int Seg = 7;
	
	makeStraightTube(CPKiel, diams_k_1, n, Seg, true);
	makeStraightTube(CPKiel, diams_k_2, n, Seg, true);
	
	FdPoint3d tube_1(0, dext1 / 2, 0), tube_2( z1, dext1 / 2, 0);
	FdPoint3d tube_ext[2] = { tube_1, tube_2 };
	makeVerySimpleTube(tube_ext, dext1, 10);
	makeVerySimpleTube(tube_ext, DU_int, 10);

	makeFlatRing(tube_2, vx, DU_int, dext1, 10);

	FdVector3d vv(vx);
	vv.rotateBy(alfa_r, vz);
	makeFlatRing(p4, vv, d1_k_ext, dext1, n);


	/************************** EXTERNAL INSULATION **************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		double dext1_ins = dext1 + 2 * size;
		double d1_k_ext_ins = d1_k_ext + 2 * size;
		DU_ext += 2 * size;

		FdPoint3d p(0, 0, 0);
		makeDonutSection(p, vz, vy, r, dext1_ins, alfa, 10, 10);

		// double alfa_r = alfa * (ARX_PI / 180);

		// p.set(0, dext1 / 2, 0);
		// FdPoint3d p1(-l1_kiel,                               dext1 / 2, 0),
		//           p2(-l1_kiel - l2_kiel,                     dext1 / 2, 0),
		//           p3(-l1_kiel - l2_kiel - l3_kiel,           dext1 / 2, 0),
		//           p4(-l1_kiel - l2_kiel - l3_kiel - l4_kiel, dext1 / 2, 0);
		// FdPoint3d CPKiel[8] = { p.rotateBy(alfa_r, vz),
		//                         p1.rotateBy(alfa_r, vz),
		//                         p1, p2.rotateBy(alfa_r, vz),
		//                         p2, p3.rotateBy(alfa_r, vz),
		//                         p3, p4.rotateBy(alfa_r, vz) };
		double diams_k_1[8] = { dext1_ins, d1_k_ext_ins, d1_k_ext_ins, d1_k_ext_ins, DU_ext, DU_ext, d1_k_ext_ins, d1_k_ext_ins };

		// int n = 20;
		// int Seg = 7;
		makeStraightTube(CPKiel, diams_k_1, n, Seg, true);

		// FdPoint3d tube_1(0,  dext1 / 2, 0),
		//           tube_2(z1, dext1 / 2, 0);
		// FdPoint3d tube_ext[2] = { tube_1, tube_2 };
		makeVerySimpleTube(tube_ext, dext1_ins, 10);

		makeFlatRing(tube_2, vx, dext1_ins, dext1, 10);

		// FdVector3d vv(vx);
		// vv.rotateBy(alfa_r, vz);
		makeFlatRing(p4, vv, d1_k_ext_ins, d1_k_ext, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeTRHT()
{
	ads_real dext1, dext2, dint1, dint2, l, alfa, z1, z2, l1_kiel, l2_kiel, l3_kiel, l4_kiel, DU_ext, DU_int, d1_k_ext, DU_ext_2, DU_int_2, d2_k_ext, y, x, rad;

	get_val("dext1", dext1);
	get_val("dext2", dext2);
	get_val("dint1", dint1);
	get_val("dint2", dint2);
	get_val("l", l);
	get_val("alfa", alfa);
	get_val("z1", z1);
	get_val("z2", z2);

	alfa=90-alfa;

	FdPoint3d p(0, 0, 0);
	double TData[2] = { dext1, l };
	double ITData[4] = { dext2, z2, z1, 0 };
	
	//double ang[2] = { 0, alfa };
	double ang_2[2] = { alfa, 90 };

	int n = 20;

	/*if( alfa == 90 )
	makeTubeToTubeIntersection2(p, vx, TData, ITData, ang, n, false);
	else*/ makeTubeToTubeIntersection2(p, vx, TData, ITData, ang_2, n, false);

	TData[0] = dint1;
	ITData[0] = dint2;

	/*if( alfa == 90)
	makeTubeToTubeIntersection2(p, vx, TData, ITData, ang, n, false);
	else*/ makeTubeToTubeIntersection2(p, vx, TData, ITData, ang_2, n, false);

	makeFlatRing(p, vx, dext1, dint1, n);

	get_val("l1_kiel", l1_kiel);
	get_val("l2_kiel", l2_kiel);
	get_val("l3_kiel", l3_kiel);
	get_val("l4_kiel", l4_kiel);
	get_val("DU_ext", DU_ext);
	get_val("DU_int", DU_int);
	get_val("d1_k_ext", d1_k_ext);
	get_val("d2_k_ext", d2_k_ext);

	p.set(l, 0, 0);
	FdPoint3d p1(l + l1_kiel, 0, 0), p2(l + l1_kiel + l2_kiel, 0, 0), p3(l + l1_kiel + l2_kiel + l3_kiel, 0, 0),p4(l + l1_kiel + l2_kiel + l3_kiel + l4_kiel, 0, 0);
	
	FdPoint3d CPKiel[8] = { p, p1, p1, p2, p2, p3, p3, p4 };
	double diams_k_1[8] = { dext1, d1_k_ext, d1_k_ext, d1_k_ext, DU_ext, DU_ext, d1_k_ext, d1_k_ext };       
	double diams_k_2[8] = { dint1, dext1, dext1, dext1, DU_int, DU_int, dext1, dext1 };
	int Seg = 7;
	
	makeStraightTube(CPKiel, diams_k_1, n, Seg, true);
	makeStraightTube(CPKiel, diams_k_2, n, Seg, true);
	makeFlatRing(p4, vx, d1_k_ext, dext1, n);

	get_val("DU_ext_2", DU_ext_2);
	get_val("DU_int_2", DU_int_2);

	p.set(z1, - z2, 0);
	FdPoint3d p5(z1, - z2 - l1_kiel, 0), p6(z1, - z2 - l1_kiel - l2_kiel, 0),  p7(z1, - z2 - l1_kiel - l2_kiel - l3_kiel, 0), p8(z1, - z2 - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0);

	FdPoint3d CPKiel_2[8] = { p, p5, p5, p6, p6, p7, p7, p8 };
	
	double diams_k_3[8] = { dext2, d2_k_ext, d2_k_ext, d2_k_ext, DU_ext_2, DU_ext_2, d2_k_ext, d2_k_ext };
	double diams_k_4[8] = { dint2, dext2, dext2, dext2, DU_int_2, DU_int_2, dext2, dext2 };
	int Seg_2 = 7;

	/*if( alfa <= 90 && alfa > 45){
	makeStraightTube(CPKiel_2, diams_k_3, n, Seg_2, true);
	makeStraightTube(CPKiel_2, diams_k_4, n, Seg_2, true);
	makeFlatRing(p8, vy, d2_k_ext, dext2, n);}*/

//	if( alfa_see <= 45 ){

	rad=(M_PI*(alfa))/180;

	x=sin(rad)*z2;
	y=cos(rad)*z2;

	alfa = 90-alfa * ( ARX_PI / 180 );
	
	//rad=(M_PI*(90-alfa_see))/180;
	

	//get_val("move", move);
	p.set(z1 + x, - y, 0);
	p5.set(z1 + x, - y - l1_kiel, 0), p6.set(z1 + x, - y - l1_kiel - l2_kiel, 0),  
	p7.set(z1 + x, - y - l1_kiel - l2_kiel - l3_kiel, 0), p8.set(z1 + x, - y - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0);

	FdVector3d v ( vz );
	v.rotateBy(alfa, vz);
	p5.rotateBy(90-alfa, v, p); p6.rotateBy(90-alfa, v, p); p7.rotateBy(90-alfa, v, p); p8.rotateBy(90-alfa, v, p);

	FdPoint3d CPKiel_3[8] = { p, p5, p5, p6, p6, p7, p7, p8 };
	
	makeStraightTube(CPKiel_3, diams_k_3, n, Seg_2, true);
	makeStraightTube(CPKiel_3, diams_k_4, n, Seg_2, true);

	FdVector3d vv ( vy );
	vv.rotateBy( 90-alfa, vz );
	makeFlatRing(p8, vv, d2_k_ext, dext2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dext1_ins = dext1 + 2 * size;
		double dext2_ins = dext2 + 2 * size;
		double d1_k_ext_ins = d1_k_ext + 2 * size;
		double d2_k_ext_ins = d2_k_ext + 2 * size;
		DU_ext += 2 * size;
		DU_ext_2 += 2 * size;

		// alfa = 90 - alfa;

		FdPoint3d p(0, 0, 0);
		double TData[2] = { dext1_ins, l };
		double ITData[4] = { dext2_ins, z2, z1, 0 };

		// int n = 20;
		// double ang_2[2] = { alfa, 90 };
		makeTubeToTubeIntersection2(p, vx, TData, ITData, ang_2, n, false);

		makeFlatRing(p, vx, dext1_ins, dext1, n);

		p.set(l, 0, 0);
		// FdPoint3d p1(l + l1_kiel,                               0, 0),
		//           p2(l + l1_kiel + l2_kiel,                     0, 0),
		//           p3(l + l1_kiel + l2_kiel + l3_kiel,           0, 0),
		//           p4(l + l1_kiel + l2_kiel + l3_kiel + l4_kiel, 0, 0);
		FdPoint3d CPKiel[7] = { p, p1, p2, p2, p3, p3, p4 };
		double diams_k_1[7] = { dext1_ins, d1_k_ext_ins, d1_k_ext_ins, DU_ext, DU_ext, d1_k_ext_ins, d1_k_ext_ins };

		int Seg = 6;
		makeStraightTube(CPKiel, diams_k_1, n, Seg, true);
		makeFlatRing(p4, vx, d1_k_ext_ins, d1_k_ext, n);

		// p.set(z1, -z2, 0);
		// FdPoint3d p5(z1, - z2 - l1_kiel,                               0),
		//           p6(z1, - z2 - l1_kiel - l2_kiel,                     0),
		//           p7(z1, - z2 - l1_kiel - l2_kiel - l3_kiel,           0),
		//           p8(z1, - z2 - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0);
		// FdPoint3d CPKiel_2[8] = { p, p5, p5, p6, p6, p7, p7, p8 };
		double diams_k_3[8] = { dext2_ins, d2_k_ext_ins, d2_k_ext_ins, d2_k_ext_ins, DU_ext_2, DU_ext_2, d2_k_ext_ins, d2_k_ext_ins };

		// int Seg_2 = 7;
		// rad = alfa * M_PI / 180;

		// x = sin(rad) * z2;
		// y = cos(rad) * z2;

		// alfa = 90 - alfa * ARX_PI / 180;

		// p.set(z1 + x, -y, 0);
		// p5.set(z1 + x, - y - l1_kiel,                               0),
		// p6.set(z1 + x, - y - l1_kiel - l2_kiel,                     0),
		// p7.set(z1 + x, - y - l1_kiel - l2_kiel - l3_kiel,           0),
		// p8.set(z1 + x, - y - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0);

		// FdVector3d v(vz);
		// v.rotateBy(alfa, vz);
		// p5.rotateBy(90 - alfa, v, p);
		// p6.rotateBy(90 - alfa, v, p);
		// p7.rotateBy(90 - alfa, v, p);
		// p8.rotateBy(90 - alfa, v, p);

		// FdPoint3d CPKiel_3[8] = { p, p5, p5, p6, p6, p7, p7, p8 };
		makeStraightTube(CPKiel_3, diams_k_3, n, Seg_2, true);

		// FdVector3d vv(vy);
		// vv.rotateBy(90 - alfa, vz);
		makeFlatRing(p8, vv, d2_k_ext_ins, d2_k_ext, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeCZJE()
{

	ads_real dext1, dext2, dint1, dint2, alfa, l, z1, z2, move, move_up;

	get_val("dext1", dext1);
	get_val("dext2", dext2);
	get_val("dint1", dint1);
	get_val("dint2", dint2);
	get_val("l", l);
	get_val("alfa", alfa);
	get_val("z1", z1);
	get_val("z2", z2);

	FdPoint3d p(0, 0, 0);
	double TData_prime[2] = { dext1, l };
	double ITData_prime[4] = { dext2, z2, z1, 0 };
	
	//double ang[2] = { 0, alfa };
	double ang_prime[2] = { alfa, 90 };

	int n = 20;

	makeTubeToTubeIntersection2(p, vx, TData_prime, ITData_prime, ang_prime, n, true);

	TData_prime[0] = dint1;
	ITData_prime[0] = dint2;

	 makeTubeToTubeIntersection2(p, vx, TData_prime, ITData_prime, ang_prime, n, true);

	makeFlatRing(p, vx, dext1, dint1, n);

	double TData[2] = { dext1, l };
	double ITData[4] = { dext2, z2, z1, 0 };
	
	//double ang[2] = { 0, alfa };
	double ang_2[2] = { alfa, 270 };

	makeTubeToTubeIntersection2(p, vx, TData, ITData, ang_2, n, true);

	TData[0] = dint1;
	ITData[0] = dint2;

	makeTubeToTubeIntersection2(p, vx, TData, ITData, ang_2, n, true);

	makeFlatRing(p, vx, dext1, dint1, n);

	ads_real l1_kiel, l2_kiel, l3_kiel, l4_kiel, d2_k_ext, DU_ext_2, DU_int_2, d1_k_ext, DU_ext, DU_int;

	get_val("l1_kiel", l1_kiel);
	get_val("l2_kiel", l2_kiel);
	get_val("l3_kiel", l3_kiel);
	get_val("l4_kiel", l4_kiel);
	get_val("d2_k_ext", d2_k_ext);
	get_val("DU_ext_2", DU_ext_2);
	get_val("DU_int_2", DU_int_2);
	get_val("d1_k_ext", d1_k_ext);
	get_val("DU_ext", DU_ext);
	get_val("DU_int", DU_int);

	p.set(l, 0, 0);
	FdPoint3d p1(l + l1_kiel, 0, 0), p2(l + l1_kiel + l2_kiel, 0, 0), p3(l + l1_kiel + l2_kiel + l3_kiel, 0, 0),p4(l + l1_kiel + l2_kiel + l3_kiel + l4_kiel, 0, 0);
	
	FdPoint3d CPKiel[8] = { p, p1, p1, p2, p2, p3, p3, p4 };
	double diams_k_1[8] = { dext1, d1_k_ext, d1_k_ext, d1_k_ext, DU_ext, DU_ext, d1_k_ext, d1_k_ext };       
	double diams_k_2[8] = { dint1, dext1, dext1, dext1, DU_int, DU_int, dext1, dext1 };
	int Seg = 7;
	
	makeStraightTube(CPKiel, diams_k_1, n, Seg, true);
	makeStraightTube(CPKiel, diams_k_2, n, Seg, true);
	makeFlatRing(p4, vx, d1_k_ext, dext1, n);

	FdPoint3d p5(z1, - z2 - l1_kiel, 0), p6(z1, - z2 - l1_kiel - l2_kiel, 0),  p7(z1, - z2 - l1_kiel - l2_kiel - l3_kiel, 0), p8(z1, - z2 - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0);
	
	alfa = alfa * ( ARX_PI / 180 );

	get_val("move", move);
	get_val("move_up", move_up);
	p.set(z1 + move, - move_up, 0);
	p5.set(z1 + move, - move_up - l1_kiel, 0), p6.set(z1 + move, - move_up - l1_kiel - l2_kiel, 0),
	p7.set(z1 + move, - move_up - l1_kiel - l2_kiel - l3_kiel, 0), p8.set(z1 + move, - move_up - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0);

	FdVector3d v ( vz );
	v.rotateBy(alfa, vz);
	p5.rotateBy(alfa, v, p); p6.rotateBy(alfa, v, p); p7.rotateBy(alfa, v, p); p8.rotateBy(alfa, v, p);

	double diams_k_3[8] = { dext2, d2_k_ext, d2_k_ext, d2_k_ext, DU_ext_2, DU_ext_2, d2_k_ext, d2_k_ext };
	double diams_k_4[8] = { dint2, dext2, dext2, dext2, DU_int_2, DU_int_2, dext2, dext2 };
	int Seg_2 = 7;

	FdPoint3d CPKiel_3[8] = { p, p5, p5, p6, p6, p7, p7, p8 };
	
	makeStraightTube(CPKiel_3, diams_k_3, n, Seg_2, true);
	makeStraightTube(CPKiel_3, diams_k_4, n, Seg_2, true);

	FdVector3d vv ( vy );
	vv.rotateBy( alfa, vz );
	makeFlatRing(p8, vv, d2_k_ext, dext2, n);

	//second muff(?)-kielich

	p.set(z1 + move, move_up, 0);
	p5.set(z1 + move, move_up + l1_kiel, 0), p6.set(z1 + move, move_up + l1_kiel + l2_kiel, 0),
	p7.set(z1 + move, move_up + l1_kiel + l2_kiel + l3_kiel, 0), p8.set(z1 + move, move_up + l1_kiel + l2_kiel + l3_kiel + l4_kiel, 0);

	FdVector3d v2 ( vz );
	v.rotateBy(-alfa, vz);
	p5.rotateBy(-alfa, v2, p); p6.rotateBy(-alfa, v2, p); p7.rotateBy(-alfa, v2, p); p8.rotateBy(-alfa, v2, p);

	FdPoint3d CPKiel_4[8] = { p, p5, p5, p6, p6, p7, p7, p8 };

	makeStraightTube(CPKiel_4, diams_k_3, n, Seg_2, true);
	makeStraightTube(CPKiel_4, diams_k_4, n, Seg_2, true);

	FdVector3d vv2 ( vy );
	vv2.rotateBy( - alfa, vz );
	makeFlatRing(p8, vv2, d2_k_ext, dext2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dext1_ins = dext1 + 2 * size;
		double dext2_ins = dext2 + 2 * size;
		double d1_k_ext_ins = d1_k_ext + 2 * size;
		double d2_k_ext_ins = d2_k_ext + 2 * size;
		DU_ext += 2 * size;
		DU_ext_2 += 2 * size;

		FdPoint3d p(0, 0, 0);
		double TData_prime[2] = { dext1_ins, l };
		double ITData_prime[4] = { dext2_ins, z2, z1, 0 };

		// int n = 20;
		// double ang_prime[2] = { alfa, 90 };
		makeTubeToTubeIntersection2(p, vx, TData_prime, ITData_prime, ang_prime, n, true);

		makeFlatRing(p, vx, dext1_ins, dext1, n);

		double TData[2] = { dext1_ins, l };
		double ITData[4] = { dext2_ins, z2, z1, 0 };

		// double ang_2[2] = { alfa, 270 };
		makeTubeToTubeIntersection2(p, vx, TData, ITData, ang_2, n, true);

		makeFlatRing(p, vx, dext1_ins, dext1, n);

		// p.set(l, 0, 0);
		// FdPoint3d p1(l + l1_kiel,                               0, 0),
		//           p2(l + l1_kiel + l2_kiel,                     0, 0),
		//           p3(l + l1_kiel + l2_kiel + l3_kiel,           0, 0),
		//           p4(l + l1_kiel + l2_kiel + l3_kiel + l4_kiel, 0, 0);
		// FdPoint3d CPKiel[8] = { p, p1, p1, p2, p2, p3, p3, p4 };
		double diams_k_1[8] = { dext1_ins, d1_k_ext_ins, d1_k_ext_ins, d1_k_ext_ins, DU_ext, DU_ext, d1_k_ext_ins, d1_k_ext_ins };

		// int Seg = 7;
		makeStraightTube(CPKiel, diams_k_1, n, Seg, true);

		makeFlatRing(p4, vx, d1_k_ext_ins, d1_k_ext, n);

		// FdPoint3d p5(z1, - z2 - l1_kiel,                               0),
		//           p6(z1, - z2 - l1_kiel - l2_kiel,                     0),
		//           p7(z1, - z2 - l1_kiel - l2_kiel - l3_kiel,           0),
		//           p8(z1, - z2 - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0);
	
		// alfa = alfa * ARX_PI / 180;

		// p.set (z1 + move, - move_up,                                         0);
		// p5.set(z1 + move, - move_up - l1_kiel,                               0);
		// p6.set(z1 + move, - move_up - l1_kiel - l2_kiel,                     0),
		// p7.set(z1 + move, - move_up - l1_kiel - l2_kiel - l3_kiel,           0);
		// p8.set(z1 + move, - move_up - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0);

		// FdVector3d v(vz);
		// v.rotateBy(alfa, vz);
		// p5.rotateBy(alfa, v, p);
		// p6.rotateBy(alfa, v, p);
		// p7.rotateBy(alfa, v, p);
		// p8.rotateBy(alfa, v, p);

		// FdPoint3d CPKiel_3[8] = { p, p5, p5, p6, p6, p7, p7, p8 };
		double diams_k_3[8] = { dext2_ins, d2_k_ext_ins, d2_k_ext_ins, d2_k_ext_ins, DU_ext_2, DU_ext_2, d2_k_ext_ins, d2_k_ext_ins };

		// int Seg_2 = 7;
		makeStraightTube(CPKiel_3, diams_k_3, n, Seg_2, true);

		// FdVector3d vv(vy);
		// vv.rotateBy(alfa, vz);
		makeFlatRing(CPKiel_3[7], vv, d2_k_ext_ins, d2_k_ext, n);  // p8, ...

		// p.set (z1 + move, move_up,                                         0);
		// p5.set(z1 + move, move_up + l1_kiel,                               0);
		// p6.set(z1 + move, move_up + l1_kiel + l2_kiel,                     0);
		// p7.set(z1 + move, move_up + l1_kiel + l2_kiel + l3_kiel,           0);
		// p8.set(z1 + move, move_up + l1_kiel + l2_kiel + l3_kiel + l4_kiel, 0);

		// FdVector3d v2(vz);
		// v.rotateBy(-alfa, vz);
		// p5.rotateBy(-alfa, v2, p);
		// p6.rotateBy(-alfa, v2, p);
		// p7.rotateBy(-alfa, v2, p);
		// p8.rotateBy(-alfa, v2, p);

		// FdPoint3d CPKiel_4[8] = { p, p5, p5, p6, p6, p7, p7, p8 };
		makeStraightTube(CPKiel_4, diams_k_3, n, Seg_2, true);

		// FdVector3d vv2(vy);
		// vv2.rotateBy(-alfa, vz);
		makeFlatRing(CPKiel_4[7], vv2, d2_k_ext_ins, d2_k_ext, n);  // p8, ...
		};

	return 0;
}

short CGeneralBlockCreator::makeKP()
{
	ads_real dext1, l,  l1_kiel, l2_kiel, l3_kiel, l4_kiel, d1_k_ext, DU_ext, DU_int;

	get_val("dext1", dext1);
	get_val("l", l);
	get_val("l1_kiel", l1_kiel);
	get_val("l2_kiel", l2_kiel);
	get_val("l3_kiel", l3_kiel);
	get_val("l4_kiel", l4_kiel);
	get_val("d1_k_ext", d1_k_ext);
	get_val("DU_ext", DU_ext);
	get_val("DU_int", DU_int);

	FdPoint3d p(l/2, 0, 0), pp(-l/2, 0, 0);
	
	FdPoint3d p1(-l/2 - l1_kiel, 0, 0), p2(-l/2 - l1_kiel - l2_kiel, 0, 0), p3(-l/2 - l1_kiel - l2_kiel - l3_kiel, 0, 0),p4(-l/2 - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0, 0);
	
	FdPoint3d CPKiel[9] = { p, pp, p1, p1, p2, p2, p3, p3, p4 };
	double diams_k_1[9] = { dext1, dext1, d1_k_ext, d1_k_ext, d1_k_ext, DU_ext, DU_ext, d1_k_ext, d1_k_ext };       
	double diams_k_2[9] = { DU_int, DU_int, dext1, dext1, dext1, DU_int, DU_int, dext1, dext1 };
	int Seg = 8;
	int n = 20;

	makeStraightTube(CPKiel, diams_k_1, n, Seg, true);
	makeStraightTube(CPKiel, diams_k_2, n, Seg, true);
	makeFlatRing(p, vx, dext1, DU_int, n);
	makeFlatRing(p4, vx, d1_k_ext, dext1, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dext1_ins = dext1 + 2 * size;
		double d1_k_ext_ins = d1_k_ext + 2 * size;
		DU_ext += 2 * size;

		// FdPoint3d p ( l / 2, 0, 0),
		//           pp(-l / 2, 0, 0);
		// FdPoint3d p1(-l / 2 - l1_kiel,                               0, 0),
		//           p2(-l / 2 - l1_kiel - l2_kiel,                     0, 0),
		//           p3(-l / 2 - l1_kiel - l2_kiel - l3_kiel,           0, 0),
		//           p4(-l / 2 - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0, 0);
		// FdPoint3d CPKiel[9] = { p, pp, p1, p1, p2, p2, p3, p3, p4 };
		double diams_k_1[9] = { dext1_ins, dext1_ins, d1_k_ext_ins, d1_k_ext_ins, d1_k_ext_ins, DU_ext, DU_ext, d1_k_ext_ins, d1_k_ext_ins };

		// int n = 20;
		// int Seg = 8;
		makeStraightTube(CPKiel, diams_k_1, n, Seg, true);
		makeFlatRing(p, vx, dext1_ins, dext1, n);
		makeFlatRing(p4, vx, d1_k_ext_ins, d1_k_ext, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeRED()
{
	ads_real dext1, dext2, l, l1_kiel, l2_kiel, l3_kiel, l4_kiel, d1_k_ext, DU_ext, DU_int, f, dint1, dint2;

	get_val("dext1", dext1);
	get_val("dext2", dext2);
	get_val("l", l);
	get_val("l1_kiel", l1_kiel);
	get_val("l2_kiel", l2_kiel);
	get_val("l3_kiel", l3_kiel);
	get_val("l4_kiel", l4_kiel);
	get_val("d1_k_ext", d1_k_ext);
	get_val("DU_ext", DU_ext);
	get_val("DU_int", DU_int);
	get_val("f", f);
	get_val("dint1", dint1);
	get_val("dint2", dint2);

	FdPoint3d p(0, 0, 0), pp(l - 10, 0, 0), ppp(l, f, 0);
	FdPoint3d cp[4] = { p, pp, pp, ppp };
	double diams1[4] = { dext1, dext1, dext1, dext2 };
	double diams2[4] = { dint1, dint1, dint1, dint2 };
	int Seg = 3;
	int n = 20;

	makeUniVectorTube(cp, vx, diams1, n, Seg, true);
	makeUniVectorTube(cp, vx, diams2, n, Seg, true);

	FdPoint3d p1(l + l1_kiel, f, 0), p2(l + l1_kiel + l2_kiel, f, 0), p3(l + l1_kiel + l2_kiel + l3_kiel, f, 0), p4(l + l1_kiel + l2_kiel + l3_kiel + l4_kiel, f, 0);
	
	FdPoint3d CPKiel[8] = { ppp, p1, p1, p2, p2, p3, p3, p4 };
	double diams_k_1[8] = { dext2, d1_k_ext, d1_k_ext, d1_k_ext, DU_ext, DU_ext, d1_k_ext, d1_k_ext };       
	double diams_k_2[8] = { dint2, dext2, dext2, dext2, DU_int, DU_int, dext2, dext2 };
	int Seg2 = 7;

	makeStraightTube(CPKiel, diams_k_1, n, Seg2, true);
	makeStraightTube(CPKiel, diams_k_2, n, Seg2, true);
	makeFlatRing(p1, vx, dext2, DU_int, n);
	makeFlatRing(p4, vx, d1_k_ext, dext2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dext1_ins = dext1 + 2 * size;
		dext2 += 2 * size;
		double d1_k_ext_ins = d1_k_ext + 2 * size;
		DU_ext += 2 * size;

		// FdPoint3d p  (0,      0, 0),
		//           pp (l - 10, 0, 0),
		//           ppp(l,      f, 0);
		// FdPoint3d cp[4] = { p, pp, pp, ppp };
		double diams1[4] = { dext1_ins, dext1_ins, dext1_ins, dext2 };

		// int n = 20;
		// int Seg = 3;
		makeUniVectorTube(cp, vx, diams1, n, Seg, true);

		makeFlatRing(p, vx, dext1_ins, dext1, n);

		// FdPoint3d p1(l + l1_kiel,                               f, 0),
		//           p2(l + l1_kiel + l2_kiel,                     f, 0),
		//           p3(l + l1_kiel + l2_kiel + l3_kiel,           f, 0),
		//           p4(l + l1_kiel + l2_kiel + l3_kiel + l4_kiel, f, 0);
		// FdPoint3d CPKiel[8] = { ppp, p1, p1, p2, p2, p3, p3, p4 };
		double diams_k_1[8] = { dext2, d1_k_ext_ins, d1_k_ext_ins, d1_k_ext_ins, DU_ext, DU_ext, d1_k_ext_ins, d1_k_ext_ins };

		// int Seg2 = 7;
		makeStraightTube(CPKiel, diams_k_1, n, Seg2, true);

		makeFlatRing(p4, vx, d1_k_ext_ins, d1_k_ext, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeRW()
{
	ads_real F1, F2, H1, H2, H3, H4, L1, L2, L3, D1, D2, D;

	get_val("F1", F1);
	get_val("F2", F2);
	get_val("H1", H1);
	get_val("H2", H2);
	get_val("H3", H3);
	get_val("H4", H4);
	get_val("L1", L1);
	get_val("L2", L2);
	get_val("L3", L3);
	get_val("D1", D1);
	get_val("D2", D2);
	get_val("D", D);

	FdPoint3d p1(0, 0, 0), p2(L3, 0, 0), p3(L3 + L2, 0, 0), p4(L3 + L2 + L1, 0, 0), p5(L3 + L2 + L1 + H4, 0, 0), p6(L3 + L2 + L1 + H4 + H3, 0, 0), p7(L3 + L2 + L1 + H4 + H3 + H2, 0, 0);
	FdPoint3d Cp_RW[] = { p1, p2, p2, p3, p3, p4, p4, p5, p5, p6, p6, p7 };
	double diams_RW[] = { D, D, D, D2, D2, D2, D1, D1, F2, D1, D1, D1, D1 };
	int seg_RW = 11;
	int n = 20;

	makeStraightTube(Cp_RW, diams_RW, n, seg_RW, true);

	FdPoint3d rotPoint(0, 0, 0);

	int count = 0;
	double wid = H1 - 45;
	while( count < 8 )
	{
		FdPoint3d pil_1(L3 + L2 + L1 + H4 + H3 + H2, - 20, D1 / 2), 
				  pil_2(L3 + L2 + L1 + H4 + H3 + H2 + wid, 20, D1 / 2), 
				  pil_3(L3 + L2 + L1 + H4 + H3 + H2, 20, D1 / 2), 
				  pil_4(L3 + L2 + L1 + H4 + H3 + H2 + wid, - 20, D1 / 2);
	
		FdPoint3d pil_p[4] = { pil_1, pil_3, pil_2, pil_4 };
		makeRotatablePlane( pil_p, vx, rotPoint, 45*count );
		count++;
	}

	FdPoint3d ps(L3 + L2 + L1 + H4 + H3 + H2 + wid, 0, 0);
	FdPoint3d Cp_ps[] = { ps, ps.set(L3 + L2 + L1 + H4 + H3 + H2 + wid + 45, 0, 0) };
	makeSimpleTube(Cp_ps, F1, .0001, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double D_ins = D + 2 * size;
		D1 += 2 * size;
		D2 += 2 * size;

		// FdPoint3d p1(0, 0, 0),
		//           p2(L3,                          0, 0),
		//           p3(L3 + L2,                     0, 0),
		//           p4(L3 + L2 + L1,                0, 0),
		//           p5(L3 + L2 + L1 + H4,           0, 0),
		//           p6(L3 + L2 + L1 + H4 + H3,      0, 0),
		//           p7(L3 + L2 + L1 + H4 + H3 + H2, 0, 0);
		FdPoint3d Cp_RW_ins[] = { p1, p1, p2, p3, p4, p4, p5 };
		double diams_RW_ins[] = { D, D_ins, D_ins, D2, D2, D1, D1 };

		// int n = 20;
		int seg_RW_ins = 6;
		makeStraightTube(Cp_RW_ins, diams_RW_ins, n, seg_RW_ins, true);

		if( D1 > F2 )
			makeFlatRing(p5, vx, D1, F2, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeCZ()
{
	
	ads_real dext1, dext2, dint1, dint2, l, alfa, z1, z2, l1_kiel, l2_kiel, l3_kiel, l4_kiel, DU_ext, DU_int, d1_k_ext, DU_ext_2, DU_int_2, d2_k_ext;

	get_val("dext1", dext1);
	get_val("dext2", dext2);
	get_val("dint1", dint1);
	get_val("dint2", dint2);
	get_val("l", l);
	get_val("alfa", alfa);
	get_val("z1", z1);
	get_val("z2", z2);

	alfa = 90 - alfa;

	FdPoint3d p(0, 0, 0);
	double TData[2] = { dext1, l };
	double ITData[4] = { dext2, z2, z1, 0 };
	
	// double ang[2] = { 0, alfa };
	double ang_2[2] = { alfa, 90 };

	int n = 20;

	makeTubeToTubeIntersection2(p, vx, TData, ITData, ang_2, n, false);

	TData[0] = dint1;
	ITData[0] = dint2;

	makeTubeToTubeIntersection2(p, vx, TData, ITData, ang_2, n, false);

	makeFlatRing(p, vx, dext1, dint1, n);

	get_val("l1_kiel", l1_kiel);
	get_val("l2_kiel", l2_kiel);
	get_val("l3_kiel", l3_kiel);
	get_val("l4_kiel", l4_kiel);
	get_val("DU_ext", DU_ext);
	get_val("DU_int", DU_int);
	get_val("d1_k_ext", d1_k_ext);
	get_val("d2_k_ext", d2_k_ext);

	p.set(l, 0, 0);
	FdPoint3d p1(l + l1_kiel,                               0, 0),
	          p2(l + l1_kiel + l2_kiel,                     0, 0),
	          p3(l + l1_kiel + l2_kiel + l3_kiel,           0, 0),
	          p4(l + l1_kiel + l2_kiel + l3_kiel + l4_kiel, 0, 0);

	FdPoint3d CPKiel[8] = { p, p1, p1, p2, p2, p3, p3, p4 };
	double diams_k_1[8] = { dext1, d1_k_ext, d1_k_ext, d1_k_ext, DU_ext, DU_ext, d1_k_ext, d1_k_ext };
	double diams_k_2[8] = { dint1, dext1, dext1, dext1, DU_int, DU_int, dext1, dext1 };

	int Seg = 7;
	makeStraightTube(CPKiel, diams_k_1, n, Seg, true);
	makeStraightTube(CPKiel, diams_k_2, n, Seg, true);
	makeFlatRing(p4, vx, d1_k_ext, dext1, n);

	get_val("DU_ext_2", DU_ext_2);
	get_val("DU_int_2", DU_int_2);

	p.set(z1, - z2, 0);
	FdPoint3d p5(z1, -z2 - l1_kiel,                               0),
	          p6(z1, -z2 - l1_kiel - l2_kiel,                     0),
	          p7(z1, -z2 - l1_kiel - l2_kiel - l3_kiel,           0),
	          p8(z1, -z2 - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0);

	double alfa_r = alfa * ARX_PI / 180;
	p5.rotateBy(alfa_r, vz, p);
	p6.rotateBy(alfa_r, vz, p);
	p7.rotateBy(alfa_r, vz, p);
	p8.rotateBy(alfa_r, vz, p);

	FdPoint3d CPKiel_2[8] = { p, p5, p5, p6, p6, p7, p7, p8 };
	double diams_k_3[8] = { dext2, d2_k_ext, d2_k_ext, d2_k_ext, DU_ext_2, DU_ext_2, d2_k_ext, d2_k_ext };
	double diams_k_4[8] = { dint2, dext2, dext2, dext2, DU_int_2, DU_int_2, dext2, dext2 };

	int Seg_2 = 7;
	makeStraightTube(CPKiel_2, diams_k_3, n, Seg_2, true);
	makeStraightTube(CPKiel_2, diams_k_4, n, Seg_2, true);

	FdVector3d vv(vy);
	vv.rotateBy(alfa_r, vz);
	makeFlatRing(p8, vv, d2_k_ext, dext2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dext1_ins = dext1 + 2 * size;
		dext2 += 2 * size;
		double d1_k_ext_ins = d1_k_ext + 2 * size;
		double d2_k_ext_ins = d2_k_ext + 2 * size;
		DU_ext_2 += 2 * size;
		DU_ext += 2 * size;

		FdPoint3d p(0, 0, 0);
		double TData[2] = { dext1_ins, l };
		double ITData[4] = { dext2, z2, z1, 0 };
	
		// int n = 20;
		// double ang_2[2] = { alfa, 90 };
		makeTubeToTubeIntersection2(p, vx, TData, ITData, ang_2, n, false);

		makeFlatRing(p, vx, dext1_ins, dext1, n);

		// p.set(l, 0, 0);
		// FdPoint3d p1(l + l1_kiel,                               0, 0),
		//           p2(l + l1_kiel + l2_kiel,                     0, 0),
		//           p3(l + l1_kiel + l2_kiel + l3_kiel,           0, 0),
		//           p4(l + l1_kiel + l2_kiel + l3_kiel + l4_kiel, 0, 0);
		// FdPoint3d CPKiel[8] = { p, p1, p1, p2, p2, p3, p3, p4 };
		double diams_k_1[8] = { dext1_ins, d1_k_ext_ins, d1_k_ext_ins, d1_k_ext_ins, DU_ext, DU_ext, d1_k_ext_ins, d1_k_ext_ins };

		// int Seg = 7;
		makeStraightTube(CPKiel, diams_k_1, n, Seg, true);

		makeFlatRing(p4, vx, d1_k_ext_ins, d1_k_ext, n);

		// p.set(z1, - z2, 0);
		// FdPoint3d p5(z1, - z2 - l1_kiel,                               0),
		//           p6(z1, - z2 - l1_kiel - l2_kiel,                     0),
		//           p7(z1, - z2 - l1_kiel - l2_kiel - l3_kiel,           0),
		//           p8(z1, - z2 - l1_kiel - l2_kiel - l3_kiel - l4_kiel, 0);

		// double alfa_r = alfa * ARX_PI / 180;
		// p5.rotateBy(alfa_r, vz, p);
		// p6.rotateBy(alfa_r, vz, p);
		// p7.rotateBy(alfa_r, vz, p);
		// p8.rotateBy(alfa_r, vz, p);

		// FdPoint3d CPKiel_2[8] = { p, p5, p5, p6, p6, p7, p7, p8 };
		double diams_k_3[8] = { dext2, d2_k_ext_ins, d2_k_ext_ins, d2_k_ext_ins, DU_ext_2, DU_ext_2, d2_k_ext_ins, d2_k_ext_ins };

		// int Seg_2 = 7;
		makeStraightTube(CPKiel_2, diams_k_3, n, Seg_2, true);

		// FdVector3d vv(vy);
		// vv.rotateBy(alfa_r, vz);
		makeFlatRing(p8, vv, d2_k_ext_ins, d2_k_ext, n);
		};

	return 0;

}

short CGeneralBlockCreator::makePIPP()
{
	ads_real Dn_out, Dn_in, l;

	get_val("Dn_out", Dn_out);
	get_val("Dn_in", Dn_in);
	get_val("l", l);

	FdPoint3d cp1( -l/2, 0, 0 ), cp2( l/2, 0, 0 );
	FdPoint3d Tcp[] = { cp1, cp2 };
	//double diams[] = { Dn_in, Dn_out, Dn_out, Dn_in };
	int n = 20;
	
	makeSimpleTube(cp1, cp2, Dn_in, Dn_in, n);
	makeSimpleTube(cp1, cp2, Dn_out, Dn_out, n);

	makeFlatRing(cp1, vx, Dn_in, Dn_out, n);

	makeFlatRing(cp2, vx, Dn_in, Dn_out, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double Dn_out_ins = Dn_out + 2 * size;

		// FdPoint3d cp1(-l / 2, 0, 0),
		//           cp2( l / 2, 0, 0);
		// FdPoint3d Tcp[] = { cp1, cp2 };

		// int n = 20;
		makeSimpleTube(cp1, cp2, Dn_out_ins, Dn_out_ins, n);
		makeFlatRing(cp1, vx, Dn_out_ins, Dn_out, n);
		makeFlatRing(cp2, vx, Dn_out_ins, Dn_out, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeELBPP()
{
	ads_real r, Dn_in, Dn_out, l, alfa;

	get_val("Dn_in", Dn_in);
	get_val("Dn_out", Dn_out);
	get_val("l", l);
	get_val("alfa", alfa);

	FdPoint3d p(0, 0, 0);

	int n = 20;
	int seg = 1;
	double diams_1[] = { Dn_in, Dn_in };
	double diams_2[] = { Dn_out, Dn_out };

	r = 0.5 * Dn_out;
	makeDonutSection(p, vz, vy, r, Dn_out, alfa, n, n);
	makeDonutSection(p, vz, vy, r, Dn_in, alfa, n, n);

	p.set(0, Dn_out / 2, 0);
	FdPoint3d p1(-l, Dn_out / 2, 0),
	          p2(l, Dn_out / 2, 0);
	double alfa_r = alfa * ARX_PI / 180;
	FdPoint3d Left[] = { p.rotateBy(alfa_r, vz), p1.rotateBy(alfa_r, vz) };

	makeStraightTube(Left, diams_1, n, seg, true);
	makeStraightTube(Left, diams_2, n, seg, true);

	FdVector3d vv(vx);
	vv.rotateBy(alfa_r, vz);
	makeFlatRing(p1, vv, Dn_in, Dn_out, n);

	p.set(0, Dn_out / 2, 0);
	FdPoint3d Right[] = { p.rotateBy(0, vz), p2.rotateBy(0, vz) };
	
	makeStraightTube(Right, diams_1, n, seg, true);
	makeStraightTube(Right, diams_2, n, seg, true);

	makeFlatRing(p2, vx, Dn_in, Dn_out, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double Dn_out_ins = Dn_out + 2 * size;

		FdPoint3d p(0, 0, 0);

		// int n = 20;
		// int seg = 1;
		double diams_1[] = { Dn_out_ins, Dn_out_ins };

		// r = 0.5 * Dn_out;
		makeDonutSection(p, vz, vy, r, Dn_out_ins, alfa, n, n);

		// p.set(0, Dn_out / 2, 0);
		// FdPoint3d p1(-l, Dn_out / 2, 0),
		//           p2( l, Dn_out / 2, 0);
		// double alfa_r = alfa * ARX_PI / 180;
		// FdPoint3d Left[] = { p.rotateBy(alfa_r, vz), p1.rotateBy(alfa_r, vz) };

		makeStraightTube(Left, diams_1, n, seg, true);

		// FdVector3d vv(vx);
		// vv.rotateBy(alfa_r, vz);
		makeFlatRing(p1, vv, Dn_out_ins, Dn_out, n);

		// p.set(0, Dn_out / 2, 0);
		// FdPoint3d Right[] = { p.rotateBy(0, vz), p2.rotateBy(0, vz) };

		makeStraightTube(Right, diams_1, n, seg, true);

		makeFlatRing(p2, vx, Dn_out_ins, Dn_out, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeMFRPP()
{
	ads_real Dn_in_1, Dn_in_2, Dn_out_1, Dn_out_2, l;

	get_val("Dn_in_1", Dn_in_1);
	get_val("Dn_in_2", Dn_in_2);
	get_val("Dn_out_1", Dn_out_1);
	get_val("Dn_out_2", Dn_out_2);
	get_val("l", l);

	FdPoint3d cp1( 0, 0, 0 ), cp2( l / 2, 0, 0 ), cp3(l, 0, 0);
	FdPoint3d Tcp[4] = { cp1, cp2, cp2, cp3 };
	FdVector3d v[2] = { vx, vx }; 
	double diams_1[4] = { Dn_in_1, Dn_in_1, Dn_in_2, Dn_in_2 };
	double diams_2[4] = { Dn_out_1, Dn_out_1, Dn_out_2, Dn_out_2 };

	int n = 20;
	int seg = 3;

	makeStraightTube(Tcp, diams_1, n, seg, true);
	makeFlatRing(cp1, vx, Dn_in_1, Dn_out_1, n);

	makeStraightTube(Tcp, diams_2, n, seg, true);
	makeFlatRing(cp3, vx, Dn_in_2, Dn_out_2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double Dn_out_1_ins = Dn_out_1 + 2 * size;
		double Dn_out_2_ins = Dn_out_2 + 2 * size;

		// FdPoint3d cp1(0,     0, 0),
		//           cp2(l / 2, 0, 0),
		//           cp3(l,     0, 0);
		// FdPoint3d Tcp[4] = { cp1, cp2, cp2, cp3 };
		// FdVector3d v[2] = { vx, vx }; 
		double diams_1[4] = { Dn_out_1_ins, Dn_out_1_ins, Dn_out_2_ins, Dn_out_2_ins };

		// int n = 20;
		// int seg = 3;
		makeStraightTube(Tcp, diams_1, n, seg, true);
		makeFlatRing(cp1, vx, Dn_out_1_ins, Dn_out_1, n);
		makeFlatRing(cp3, vx, Dn_out_2_ins, Dn_out_2, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeTRPP()
{
	ads_real Dn_out, Dn_in, l1, l2;

	get_val("Dn_out", Dn_out);
	get_val("Dn_in", Dn_in);
	get_val("l1", l1);
	get_val("l2", l2);

	FdPoint3d cp_1(0, 0, 0), cp_2(0, l1, 0);
	//FdPoint3d cpT[] = { cp_1, cp_2 };
	double tubePar[] = { Dn_out, Dn_out, l1 };
	double interTubePos[] = { l1 / 2, 0 };
	double interTubePar[] = { l2, Dn_out, Dn_out };
	double ang[] = { 90, 90, 270 };
	int complex[] = { 20, 20 };
	bool opt[] = { false, false, false };

	makeTubeToTubeIntersection(cp_1, vx, tubePar, interTubePos, interTubePar, ang, complex, opt);
	
	double tubePar_2[] = { Dn_in, Dn_in, l1 };
	double interTubePar_2[] = { l2, Dn_in, Dn_in };

	makeTubeToTubeIntersection(cp_1, vx, tubePar_2, interTubePos, interTubePar_2, ang, complex, opt);

	FdPoint3d cp_3(l1/ 2, l2, 0);
	cp_2.set( l1, 0, 0);

	makeFlatRing(cp_1, vx, Dn_in, Dn_out, 20);
	makeFlatRing(cp_2, vx, Dn_in, Dn_out, 20);
	makeFlatRing(cp_3, vy, Dn_in, Dn_out, 20);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double Dn_out_ins = Dn_out + 2 * size;

		// FdPoint3d cp_1(0, 0, 0),
		//           cp_2(0, l1, 0);
		double tubePar[] = { Dn_out_ins, Dn_out_ins, l1 };
		// double interTubePos[] = { l1 / 2, 0 };
		double interTubePar[] = { l2, Dn_out_ins, Dn_out_ins };
		// double ang[] = { 90, 90, 270 };
		// int complex[] = { 20, 20 };
		// bool opt[] = { false, false, false };

		makeTubeToTubeIntersection(cp_1, vx, tubePar, interTubePos, interTubePar, ang, complex, opt);

		// FdPoint3d cp_3(l1 / 2, l2, 0);
		// cp_2.set(l1, 0, 0);

		makeFlatRing(cp_1, vx, Dn_out_ins, Dn_out, 20);
		makeFlatRing(cp_2, vx, Dn_out_ins, Dn_out, 20);
		makeFlatRing(cp_3, vy, Dn_out_ins, Dn_out, 20);
		};

	return 0;
}

short CGeneralBlockCreator::makeTRREDPP()
{
	ads_real Dn1_in, Dn2_in, Dn3_in, Dn1_out, Dn2_out, Dn3_out, l1, l2;

	get_val("Dn1_in", Dn1_in);
	get_val("Dn2_in", Dn2_in);
	get_val("Dn3_in", Dn3_in);
	get_val("Dn1_out", Dn1_out);
	get_val("Dn2_out", Dn2_out);
	get_val("Dn3_out", Dn3_out);
	get_val("l1", l1);
	get_val("l2", l2);

	FdPoint3d cp_1(0, 0, 0), cp_2(0, l1, 0);
	FdPoint3d cpT[] = { cp_1, cp_2 };
	double tubePar[] = { Dn1_out, Dn3_out, l1 };
	double interTubePos[] = { l1 / 2, 0 };
	double interTubePar[] = { l2, Dn2_out, Dn2_out };
	double ang[] = { 90, 90, 270 };
	int complex[] = { 20, 20 };
	bool opt[] = { false, false, false };

	makeTubeToTubeIntersection(cp_1, vx, tubePar, interTubePos, interTubePar, ang, complex, opt);
	
	double tubePar_2[] = { Dn1_in, Dn3_in, l1 };
	double interTubePar_2[] = { l2, Dn2_in, Dn2_in };

	makeTubeToTubeIntersection(cp_1, vx, tubePar_2, interTubePos, interTubePar_2, ang, complex, opt);
	
	FdPoint3d cp_3(l1/ 2, l2, 0);
	cp_2.set( l1, 0, 0);

	makeFlatRing(cp_1, vx, Dn1_in, Dn1_out, 20);
	makeFlatRing(cp_2, vx, Dn1_in, Dn1_out, 20);
	makeFlatRing(cp_3, vy, Dn2_in, Dn2_out, 20);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double Dn1_out_ins = Dn1_out + 2 * size;
		double Dn2_out_ins = Dn2_out + 2 * size;
		double Dn3_out_ins = Dn3_out + 2 * size;

		// FdPoint3d cp_1(0, 0,  0),
		//           cp_2(0, l1, 0);
		// FdPoint3d cpT[] = { cp_1, cp_2 };
		double tubePar[] = { Dn1_out_ins, Dn3_out_ins, l1 };
		// double interTubePos[] = { l1 / 2, 0 };
		double interTubePar[] = { l2, Dn2_out_ins, Dn2_out_ins };
		// double ang[] = { 90, 90, 270 };
		// int complex[] = { 20, 20 };
		// bool opt[] = { false, false, false };

		makeTubeToTubeIntersection(cp_1, vx, tubePar, interTubePos, interTubePar, ang, complex, opt);

		// FdPoint3d cp_3(l1 / 2, l2, 0);
		// cp_2.set(l1, 0, 0);

		makeFlatRing(cp_1, vx, Dn1_out_ins, Dn1_out, 20);
		makeFlatRing(cp_2, vx, Dn1_out_ins, Dn1_out, 20);
		makeFlatRing(cp_3, vy, Dn2_out_ins, Dn2_out, 20);
		};

	return 0;
}

short CGeneralBlockCreator::makeZLPEX()
{
	ads_real dn_in, dn_out, l1, l1_bis, l2;

	get_val("dn_in", dn_in);
	get_val("dn_out", dn_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);

	FdPoint3d cp1(0, 0, 0), cp2(l1_bis, 0 ,0 ), cp2_2(l1+l1_bis, 0, 0), cp3(l1+l1_bis+l2, 0, 0), cp4(l1+l1_bis+l2*2, 0, 0), 
			  cp5(l1+l1_bis+l2*3, 0, 0), cp6(l1+l1_bis+l2*4, 0, 0), cp7(l1+l1_bis+l2*5, 0, 0), cp8(l1*2+l1_bis+l2*5, 0, 0), cp9(l1*2+l1_bis+l2*5+l1_bis, 0, 0);

	FdPoint3d ZLcp[17] = { cp1, cp2, cp2_2, cp2_2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7, cp8, cp8, cp9 };
	double diams[17] = { dn_in+2, dn_in, dn_in, dn_in+4, dn_in+4, dn_in+1, dn_in+1, dn_in, dn_in, dn_in+1, dn_in+1, dn_in+4, dn_in+4, dn_in, dn_in, dn_in, dn_in+2 };
	int n = 10;

	makeStraightTube(ZLcp, diams, n, 16, true);
	
	double diams_1[17] = { dn_out+2, dn_out, dn_out, dn_out+4, dn_out+4, dn_out+1, dn_out+1, dn_out, dn_out, dn_out+1, dn_out+1, dn_out+4, dn_out+4, dn_out, dn_out, dn_out, dn_out+2 };

	makeStraightTube(ZLcp, diams_1, n, 16, true);
	makeFlatRing(cp9, vx, dn_in+2, dn_out+2, n);
	makeFlatRing(cp1, vx, dn_in+2, dn_out+2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn_out_ins = dn_out + 2 * size;

		// FdPoint3d cp1  (0,                                 0, 0),
		//           cp2  (         l1_bis,                   0, 0),
		//           cp2_2(l1     + l1_bis,                   0, 0),
		//           cp3  (l1     + l1_bis + l2,              0, 0),
		//           cp4  (l1     + l1_bis + l2 * 2,          0, 0),
		//           cp5  (l1     + l1_bis + l2 * 3,          0, 0),
		//           cp6  (l1     + l1_bis + l2 * 4,          0, 0),
		//           cp7  (l1     + l1_bis + l2 * 5,          0, 0),
		//           cp8  (l1 * 2 + l1_bis + l2 * 5,          0, 0),
		//           cp9  (l1 * 2 + l1_bis + l2 * 5 + l1_bis, 0, 0);
		// FdPoint3d ZLcp[17] = { cp1, cp2, cp2_2, cp2_2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7, cp8, cp8, cp9 };
		double diams[17] = { dn_out_ins + 2, dn_out_ins, dn_out_ins, dn_out_ins + 4, dn_out_ins + 4, dn_out_ins + 1, dn_out_ins + 1, dn_out_ins, dn_out_ins,
		                     dn_out_ins + 1, dn_out_ins + 1, dn_out_ins + 4, dn_out_ins + 4, dn_out_ins, dn_out_ins, dn_out_ins, dn_out_ins + 2 };

		// int n = 10;
		makeStraightTube(ZLcp, diams, n, 16, true);

		makeFlatRing(cp9, vx, dn_out_ins + 2, dn_out + 2, n);
		makeFlatRing(cp1, vx, dn_out_ins + 2, dn_out + 2, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeZLREDPEX()
{
	ads_real dn1_in, dn1_out, dn2_in, dn2_out, l1, l1_bis, l2;

	get_val("dn1_in", dn1_in);
	get_val("dn1_out", dn1_out);
	get_val("dn2_in", dn2_in);
	get_val("dn2_out", dn2_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);

	FdPoint3d cp1(0, 0, 0), cp2(l1_bis, 0 ,0 ), cp2_2(l1+l1_bis, 0, 0), cp3(l1+l1_bis+l2, 0, 0), cp4(l1+l1_bis+l2*2, 0, 0), 
			  cp5(l1+l1_bis+l2*3, 0, 0), cp6(l1+l1_bis+l2*4, 0, 0), cp7(l1+l1_bis+l2*5, 0, 0), cp8(l1*2+l1_bis+l2*5, 0, 0),  cp9(l1*2+l1_bis+l2*5+l1_bis, 0, 0);

	FdPoint3d ZLcp[17] = { cp1, cp2, cp2_2, cp2_2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7, cp8, cp8, cp9 };
	double diams[17] = { dn1_in+2, dn1_in, dn1_in, dn1_in+4, dn1_in+4, dn1_in+1, dn1_in+1, dn1_in, 
						 dn1_in, dn2_in+1, dn2_in+1, dn2_in+4, dn2_in+4, dn2_in, dn2_in, dn2_in, dn2_in+2 };
	int n = 10;

	makeStraightTube(ZLcp, diams, n, 16, true);
	
	double diams_1[17] = { dn1_out+2, dn1_out, dn1_out, dn1_out+4, dn1_out+4, dn1_out+1, dn1_out+1, dn1_out, 
						   dn1_out, dn2_out+1, dn2_out+1, dn2_out+4, dn2_out+4, dn2_out, dn2_out, dn2_out, dn2_out+2 };

	makeStraightTube(ZLcp, diams_1, n, 16, true);
	makeFlatRing(cp9, vx, dn2_in+2, dn2_out+2, n);
	makeFlatRing(cp1, vx, dn1_in+2, dn1_out+2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn1_out_ins = dn1_out + 2 * size;
		double dn2_out_ins = dn2_out + 2 * size;

		// FdPoint3d cp1  (0,                                 0, 0),
		//           cp2  (         l1_bis,                   0, 0),
		//           cp2_2(l1     + l1_bis,                   0, 0),
		//           cp3  (l1     + l1_bis + l2,              0, 0),
		//           cp4  (l1     + l1_bis + l2 * 2,          0, 0),
		//           cp5  (l1     + l1_bis + l2 * 3,          0, 0),
		//           cp6  (l1     + l1_bis + l2 * 4,          0, 0),
		//           cp7  (l1     + l1_bis + l2 * 5,          0, 0),
		//           cp8  (l1 * 2 + l1_bis + l2 * 5,          0, 0),
		//           cp9  (l1 * 2 + l1_bis + l2 * 5 + l1_bis, 0, 0);

		// FdPoint3d ZLcp[17] = { cp1, cp2, cp2_2, cp2_2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7, cp8, cp8, cp9 };
		double diams[17] = { dn1_out_ins + 2, dn1_out_ins, dn1_out_ins, dn1_out_ins + 4, dn1_out_ins + 4, dn1_out_ins + 1, dn1_out_ins + 1, dn1_out_ins, dn1_out_ins,
		                     dn2_out_ins + 1, dn2_out_ins + 1, dn2_out_ins + 4, dn2_out_ins + 4, dn2_out_ins, dn2_out_ins, dn2_out_ins, dn2_out_ins + 2 };

		// int n = 10;
		makeStraightTube(ZLcp, diams, n, 16, true);

		makeFlatRing(cp1, vx, dn1_out_ins + 2, dn1_out + 2, n);
		makeFlatRing(cp9, vx, dn2_out_ins + 2, dn2_out + 2, n);
		};

	return 0;
}


short CGeneralBlockCreator::makeELBPEX()
{
	ads_real r, alfa, dn_in, dn_out, l1, l1_bis, l2, l3;

	get_val("dn_in", dn_in);
	get_val("dn_out", dn_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);
	get_val("l3", l3);
	
	get_val("r", r);
	get_val("alfa", alfa);

	r = 1.0 * dn_out;

	FdPoint3d cp1_don(0, 0, 0);
	
	makeDonutSection(cp1_don, vz, vy, r, dn_out - 2, alfa, 10, 10);
	makeDonutSection(cp1_don, vz, vy, r, dn_in  - 2, alfa, 10, 10);

	int n = 10;

	FdPoint3d cp1(0, dn_in+1, 0), cp2(l3, dn_in+1, 0), cp3(l3+l2, dn_in+1, 0 ), cp4(l3+l2*2, dn_in+1, 0), cp5(l3+l2*3, dn_in+1, 0), cp6(l3+l2*3+l1, dn_in+1, 0), cp7(l3+l2*3+l1+l1_bis, dn_in+1, 0);

	FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };
	double diams[] = { dn_in-2, dn_in-2, dn_in, dn_in, dn_in+1, dn_in+1, dn_in+4, dn_in+4, dn_in, dn_in, dn_in+2 };

	double diams_1[] = { dn_out-2, dn_out-2, dn_out, dn_out, dn_out+1, dn_out+1, dn_out+4, dn_out+4, dn_out, dn_out, dn_out+2 };

	makeStraightTube(ZLcp, diams, n, 10, true);
	makeStraightTube(ZLcp, diams_1, n, 10, true);
	makeFlatRing(cp7, vx, dn_in + 2, dn_out + 2, n);

	/*-------------------------------SECOND CONNECTOR-------------------------------*/

	FdPoint3d cp1_1(-dn_in - 1,  0,                         0),
	          cp2_2(-dn_in - 1, -l3,                        0),
	          cp3_3(-dn_in - 1, -l3 - l2,                   0),
	          cp4_4(-dn_in - 1, -l3 - l2 * 2,               0),
	          cp5_5(-dn_in - 1, -l3 - l2 * 3,               0),
	          cp6_6(-dn_in - 1, -l3 - l2 * 3 - l1,          0),
	          cp7_7(-dn_in - 1, -l3 - l2 * 3 - l1 - l1_bis, 0);

	int alfa2 = 270 + (int) alfa;
	double alfa_r = alfa2 * ARX_PI / 180;  // alfa * ARX_PI / 180
	FdPoint3d ZLcp_2[] = { cp1_1.rotateBy(alfa_r, vz),
	                       cp2_2.rotateBy(alfa_r, vz),
	                       cp2_2,
	                       cp3_3.rotateBy(alfa_r, vz),
	                       cp3_3,
	                       cp4_4.rotateBy(alfa_r, vz),
	                       cp4_4,
	                       cp5_5.rotateBy(alfa_r, vz),
	                       cp5_5,
	                       cp6_6.rotateBy(alfa_r, vz),
	                       cp7_7.rotateBy(alfa_r, vz) };

	makeStraightTube(ZLcp_2, diams, n, 10, true);
	makeStraightTube(ZLcp_2, diams_1, n, 10, true);

	FdVector3d vv(vy);
	vv.rotateBy(alfa_r, vz);
	makeFlatRing(cp7_7, vv, dn_in + 2, dn_out + 2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn_out_ins = dn_out + 2 * size;

		// r = 1.0 * dn_out;
		// FdPoint3d cp1_don(0, 0, 0);

		makeDonutSection(cp1_don, vz, vy, r, dn_out_ins - 2, alfa, 10, 10);

		// FdPoint3d cp1(0,                         dn_in + 1, 0),
		//           cp2(l3,                        dn_in + 1, 0),
		//           cp3(l3 + l2,                   dn_in + 1, 0),
		//           cp4(l3 + l2 * 2,               dn_in + 1, 0),
		//           cp5(l3 + l2 * 3,               dn_in + 1, 0),
		//           cp6(l3 + l2 * 3 + l1,          dn_in + 1, 0),
		//           cp7(l3 + l2 * 3 + l1 + l1_bis, dn_in + 1, 0);
		// FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };
		double diams[] = { dn_out_ins - 2, dn_out_ins - 2, dn_out_ins, dn_out_ins, dn_out_ins + 1, dn_out_ins + 1,
		                   dn_out_ins + 4, dn_out_ins + 4, dn_out_ins, dn_out_ins, dn_out_ins + 2 };

		// int n = 10;
		makeStraightTube(ZLcp, diams, n, 10, true);
		makeFlatRing(cp7, vx, dn_out_ins + 2, dn_out + 2, n);

		/*-------------------------------SECOND CONNECTOR-------------------------------*/

		// FdPoint3d cp1_1(-dn_in - 1,  0,                         0),
		//           cp2_2(-dn_in - 1, -l3,                        0),
		//           cp3_3(-dn_in - 1, -l3 - l2,                   0),
		//           cp4_4(-dn_in - 1, -l3 - l2 * 2,               0),
		//           cp5_5(-dn_in - 1, -l3 - l2 * 3,               0),
		//           cp6_6(-dn_in - 1, -l3 - l2 * 3 - l1,          0),
		//           cp7_7(-dn_in - 1, -l3 - l2 * 3 - l1 - l1_bis, 0);

		// int alfa2 = 270 + alfa;
		// double alfa_r = alfa2 * ARX_PI / 180;  // alfa * ARX_PI / 180
		// FdPoint3d ZLcp_2[] = { cp1_1.rotateBy(alfa_r, vz),
		//                        cp2_2.rotateBy(alfa_r, vz),
		//                        cp2_2,
		//                        cp3_3.rotateBy(alfa_r, vz),
		//                        cp3_3,
		//                        cp4_4.rotateBy(alfa_r, vz),
		//                        cp4_4,
		//                        cp5_5.rotateBy(alfa_r, vz),
		//                        cp5_5,
		//                        cp6_6.rotateBy(alfa_r, vz),
		//                        cp7_7.rotateBy(alfa_r, vz) };

		makeStraightTube(ZLcp_2, diams, n, 10, true);
	
		// FdVector3d vv(vy);
		// vv.rotateBy(alfa_r, vz);
		makeFlatRing(cp7_7, vv, dn_out_ins + 2, dn_out + 2, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeTRPEX()
{
	ads_real dn_in, dn_out, l1, l1_bis, l2;

	get_val("dn_in", dn_in);
	get_val("dn_out", dn_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);

	FdPoint3d cp( 0, 0, 0);
	double tubePar[] = { dn_in-1, dn_in-1, dn_out };
	double interTPos[] = { dn_out / 2, 0 };
	double interTPar[] = { dn_out / 2, dn_in-1, dn_in-1 };
	double ang[] = { 90, 90, 90 };
	int comp[] = { 10, 10 };
	bool opt[] = { false, false, false };

	makeTubeToTubeIntersection(cp, vx, tubePar, interTPos, interTPar, ang, comp, opt);

	double tubePar_1[] = { dn_out-1, dn_out-1, dn_out };
	double interTPar_1[] = { dn_out / 2, dn_out-1, dn_out-1 };

	makeTubeToTubeIntersection(cp, vx, tubePar_1, interTPos, interTPar_1, ang, comp, opt);

	int n = 10;

	FdPoint3d cp1(dn_out, 0, 0), cp2(dn_out, 0, 0), cp3(dn_out+l2, 0, 0 ), cp4(dn_out+l2*2, 0, 0), cp5(dn_out+l2*3, 0, 0), cp6(dn_out+l2*3+l1, 0, 0), 
			  cp7(dn_out+l2*3+l1+l1_bis, 0, 0);

	FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };

	double diams[] = { dn_in-2, dn_in-2, dn_in, dn_in, dn_in+1, dn_in+1, dn_in+4, dn_in+4, dn_in, dn_in, dn_in+2 };

	double diams_1[] = { dn_out-2, dn_out-2, dn_out, dn_out, dn_out+1, dn_out+1, dn_out+4, dn_out+4, dn_out, dn_out, dn_out+2 };
	
	makeStraightTube(ZLcp, diams, n, 10, true);
	makeStraightTube(ZLcp, diams_1, n, 10, true);

/*-------------------------------SECOND CONNECTOR-------------------------------*/

	FdPoint3d cp1_1(0, 0, 0), cp2_2(0, 0, 0), cp3_3(-l2, 0, 0 ), cp4_4(-l2*2, 0, 0), cp5_5(-l2*3, 0, 0), cp6_6(-l2*3-l1, 0, 0), cp7_7(-l2*3-l1-l1_bis, 0, 0);

	FdPoint3d ZLcp_1[] = { cp1_1, cp2_2, cp2_2, cp3_3, cp3_3, cp4_4, cp4_4, cp5_5, cp5_5, cp6_6, cp7_7 };

	makeStraightTube(ZLcp_1, diams, n, 10, true);
	makeStraightTube(ZLcp_1, diams_1, n, 10, true);

/*-------------------------------THIRD CONNECTOR-------------------------------*/

	FdPoint3d cp1_1_bis(dn_out / 2, -dn_out / 2,                        0),
	          cp2_2_bis(dn_out / 2, -dn_out / 2,                        0),
	          cp3_3_bis(dn_out / 2, -dn_out / 2 - l2,                   0),
	          cp4_4_bis(dn_out / 2, -dn_out / 2 - l2 * 2,               0),
	          cp5_5_bis(dn_out / 2, -dn_out / 2 - l2 * 3,               0),
	          cp6_6_bis(dn_out / 2, -dn_out / 2 - l2 * 3 - l1,          0),
	          cp7_7_bis(dn_out / 2, -dn_out / 2 - l2 * 3 - l1 - l1_bis, 0);
	FdPoint3d ZLcp_2[] = { cp1_1_bis, cp2_2_bis, cp2_2_bis, cp3_3_bis, cp3_3_bis, cp4_4_bis,
	                       cp4_4_bis, cp5_5_bis, cp5_5_bis, cp6_6_bis, cp7_7_bis };

	makeUniVectorTube(ZLcp_2, vy, diams, n, 10, true);
	makeUniVectorTube(ZLcp_2, vy, diams_1, n, 10, true);

	makeFlatRing(cp7, vx, dn_in + 2, dn_out + 2, n);
	makeFlatRing(cp7_7, vx, dn_in + 2, dn_out + 2, n);
	makeFlatRing(cp7_7_bis, vy, dn_in + 2, dn_out + 2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn_out_ins = dn_out + 2 * size;

		// FdPoint3d cp(0, 0, 0);
		// double interTPos[] = { dn_out / 2, 0 };
		// double ang[] = { 90, 90, 90 };
		// int comp[] = { 10, 10 };
		// bool opt[] = { false, false, false };

		double tubePar[] = { dn_out_ins - 1, dn_out_ins - 1, dn_out };
		double interTPar[] = { dn_out / 2, dn_out_ins - 1, dn_out_ins - 1 };

		makeTubeToTubeIntersection(cp, vx, tubePar, interTPos, interTPar, ang, comp, opt);

		// FdPoint3d cp1(dn_out,                        0, 0),
		//           cp2(dn_out,                        0, 0),
		//           cp3(dn_out + l2,                   0, 0),
		//           cp4(dn_out + l2 * 2,               0, 0),
		//           cp5(dn_out + l2 * 3,               0, 0),
		//           cp6(dn_out + l2 * 3 + l1,          0, 0),
		//           cp7(dn_out + l2 * 3 + l1 + l1_bis, 0, 0);
		// FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };
		double diams[] = { dn_out_ins - 2, dn_out_ins - 2, dn_out_ins, dn_out_ins, dn_out_ins + 1, dn_out_ins + 1,
		                   dn_out_ins + 4, dn_out_ins + 4, dn_out_ins, dn_out_ins, dn_out_ins + 2 };

		// int n = 10;
		makeStraightTube(ZLcp, diams, n, 10, true);
		makeFlatRing(cp7, vx, dn_out_ins + 2, dn_out + 2, n);

		/*-------------------------------SECOND CONNECTOR-------------------------------*/

		// FdPoint3d cp1_1( 0,                    0, 0),
		//           cp2_2( 0,                    0, 0),
		//           cp3_3(-l2,                   0, 0),
		//           cp4_4(-l2 * 2,               0, 0),
		//           cp5_5(-l2 * 3,               0, 0),
		//           cp6_6(-l2 * 3 - l1,          0, 0),
		//           cp7_7(-l2 * 3 - l1 - l1_bis, 0, 0);
		// FdPoint3d ZLcp_1[] = { cp1_1, cp2_2, cp2_2, cp3_3, cp3_3, cp4_4,
		//                        cp4_4, cp5_5, cp5_5, cp6_6, cp7_7 };

		makeStraightTube(ZLcp_1, diams, n, 10, true);
		makeFlatRing(cp7_7, vx, dn_out_ins + 2, dn_out + 2, n);

		/*-------------------------------THIRD CONNECTOR-------------------------------*/

		// FdPoint3d cp1_1_bis(dn_out / 2, -dn_out / 2,                        0),
		//           cp2_2_bis(dn_out / 2, -dn_out / 2,                        0),
		//           cp3_3_bis(dn_out / 2, -dn_out / 2 - l2,                   0),
		//           cp4_4_bis(dn_out / 2, -dn_out / 2 - l2 * 2,               0),
		//           cp5_5_bis(dn_out / 2, -dn_out / 2 - l2 * 3,               0),
		//           cp6_6_bis(dn_out / 2, -dn_out / 2 - l2 * 3 - l1,          0),
		//           cp7_7_bis(dn_out / 2, -dn_out / 2 - l2 * 3 - l1 - l1_bis, 0);
		// FdPoint3d ZLcp_2[] = { cp1_1_bis, cp2_2_bis, cp2_2_bis, cp3_3_bis, cp3_3_bis, cp4_4_bis,
		//                        cp4_4_bis, cp5_5_bis, cp5_5_bis, cp6_6_bis, cp7_7_bis };

		makeUniVectorTube(ZLcp_2, vy, diams, n, 10, true);
		makeFlatRing(cp7_7_bis, vy, dn_out_ins + 2, dn_out + 2, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeTRREDPEX()
{
	ads_real dn1_in, dn1_out, dn2_in, dn2_out, dn3_in, dn3_out, l1, l1_bis, l2;

	get_val("dn1_in", dn1_in);
	get_val("dn1_out", dn1_out);
	get_val("dn2_in", dn2_in);
	get_val("dn2_out", dn2_out);
	get_val("dn3_in", dn3_in);
	get_val("dn3_out", dn3_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);

	FdPoint3d cp( 0, 0, 0);
	double tubePar[] = { dn1_in-1, dn1_in-1, dn1_out };
	double interTPos[] = { dn1_out / 2, 0 };
	double interTPar[] = { dn1_out / 2, dn1_in-1, dn1_in-1 };
	double ang[] = { 90, 90, 90 };
	int comp[] = { 10, 10 };
	bool opt[] = { false, false, false };

	makeTubeToTubeIntersection(cp, vx, tubePar, interTPos, interTPar, ang, comp, opt);

	double tubePar_1[] = { dn1_out-1, dn1_out-1, dn1_out };
	double interTPar_1[] = { dn1_out / 2, dn1_out-1, dn1_out-1 };

	makeTubeToTubeIntersection(cp, vx, tubePar_1, interTPos, interTPar_1, ang, comp, opt);

	int n = 10;

	FdPoint3d cp1(dn1_out, 0, 0), cp2(dn1_out, 0, 0), cp3(dn1_out+l2, 0, 0 ), cp4(dn1_out+l2*2, 0, 0), cp5(dn1_out+l2*3, 0, 0), cp6(dn1_out+l2*3+l1, 0, 0), 
			  cp7(dn1_out+l2*3+l1+l1_bis, 0, 0);

	FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };

	double diams[] = { dn1_in-1, dn1_in-1, dn2_in, dn2_in, dn2_in+1, dn2_in+1, dn2_in+4, dn2_in+4, dn2_in, dn2_in, dn2_in+2 };
	double diams_1[] = { dn1_out-1, dn1_out-1, dn2_out, dn2_out, dn2_out+1, dn2_out+1, dn2_out+4, dn2_out+4, dn2_out, dn2_out, dn2_out+2 };
	
	makeStraightTube(ZLcp, diams, n, 10, true);
	makeStraightTube(ZLcp, diams_1, n, 10, true);

/*-------------------------------SECOND CONNECTOR-------------------------------*/

	double diams_sec[] = { dn1_in-2, dn1_in-2, dn1_in, dn1_in, dn1_in+1, dn1_in+1, dn1_in+4, dn1_in+4, dn1_in, dn1_in, dn1_in+2 };
	double diams_sec_1[] = { dn1_out-2, dn1_out-2, dn1_out, dn1_out, dn1_out+1, dn1_out+1, dn1_out+4, dn1_out+4, dn1_out, dn1_out, dn1_out+2 };

	FdPoint3d cp1_1(0, 0, 0), cp2_2(0, 0, 0), cp3_3(-l2, 0, 0 ), cp4_4(-l2*2, 0, 0), cp5_5(-l2*3, 0, 0), cp6_6(-l2*3-l1, 0, 0), cp7_7(-l2*3-l1-l1_bis, 0, 0);

	FdPoint3d ZLcp_1[] = { cp1_1, cp2_2, cp2_2, cp3_3, cp3_3, cp4_4, cp4_4, cp5_5, cp5_5, cp6_6, cp7_7 };

	makeStraightTube(ZLcp_1, diams_sec, n, 10, true);
	makeStraightTube(ZLcp_1, diams_sec_1, n, 10, true);

/*-------------------------------THIRD CONNECTOR-------------------------------*/

	double diams_sec_3[] = { dn1_in-1, dn1_in-1, dn3_in, dn3_in, dn3_in+1, dn3_in+1, dn3_in+4, dn3_in+4, dn3_in, dn3_in, dn3_in+2 };
	double diams_sec_3_bis[] = { dn1_out-1, dn1_out-1, dn3_out, dn3_out, dn3_out+1, dn3_out+1, dn3_out+4, dn3_out+4, dn3_out, dn3_out, dn3_out+2 };
	
	FdPoint3d cp1_1_bis(dn1_out / 2, -dn1_out / 2,                        0),
	          cp2_2_bis(dn1_out / 2, -dn1_out / 2,                        0),
	          cp3_3_bis(dn1_out / 2, -dn1_out / 2 - l2,                   0),
	          cp4_4_bis(dn1_out / 2, -dn1_out / 2 - l2 * 2,               0),
	          cp5_5_bis(dn1_out / 2, -dn1_out / 2 - l2 * 3,               0),
	          cp6_6_bis(dn1_out / 2, -dn1_out / 2 - l2 * 3 - l1,          0),
	          cp7_7_bis(dn1_out / 2, -dn1_out / 2 - l2 * 3 - l1 - l1_bis, 0);
	FdPoint3d ZLcp_2[] = { cp1_1_bis, cp2_2_bis, cp2_2_bis, cp3_3_bis, cp3_3_bis, cp4_4_bis,
	                       cp4_4_bis, cp5_5_bis, cp5_5_bis, cp6_6_bis, cp7_7_bis };

	makeUniVectorTube(ZLcp_2, vy, diams_sec_3, n, 10, true);
	makeUniVectorTube(ZLcp_2, vy, diams_sec_3_bis, n, 10, true);

	makeFlatRing(cp7, vx, dn2_in + 2, dn2_out + 2, n);
	makeFlatRing(cp7_7, vx, dn1_in + 2, dn1_out + 2, n);
	makeFlatRing(cp7_7_bis, vy, dn3_in + 2, dn3_out + 2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn1_out_ins = dn1_out + 2 * size;
		double dn2_out_ins = dn2_out + 2 * size;
		double dn3_out_ins = dn3_out + 2 * size;

		// FdPoint3d cp(0, 0, 0);
		// double interTPos[] = { dn1_out / 2, 0 };
		// double ang[] = { 90, 90, 90 };
		// int comp[] = { 10, 10 };
		// bool opt[] = { false, false, false };

		double tubePar[] = { dn1_out_ins - 1, dn1_out_ins - 1, dn1_out };
		double interTPar[] = { dn1_out / 2, dn1_out_ins - 1, dn1_out_ins - 1 };

		makeTubeToTubeIntersection(cp, vx, tubePar, interTPos, interTPar, ang, comp, opt);

		// FdPoint3d cp1(dn1_out,                        0, 0),
		//           cp2(dn1_out,                        0, 0),
		//           cp3(dn1_out + l2,                   0, 0),
		//           cp4(dn1_out + l2 * 2,               0, 0),
		//           cp5(dn1_out + l2 * 3,               0, 0),
		//           cp6(dn1_out + l2 * 3 + l1,          0, 0),
		//           cp7(dn1_out + l2 * 3 + l1 + l1_bis, 0, 0);
		// FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };
		double diams[] = { dn1_out_ins - 1, dn1_out_ins - 1, dn2_out_ins, dn2_out_ins, dn2_out_ins + 1, dn2_out_ins + 1,
		                   dn2_out_ins + 4, dn2_out_ins + 4, dn2_out_ins, dn2_out_ins, dn2_out_ins + 2 };

		// int n = 10;
		makeStraightTube(ZLcp, diams, n, 10, true);
		makeFlatRing(cp7, vx, dn2_out_ins + 2, dn2_out + 2, n);

		/*-------------------------------SECOND CONNECTOR-------------------------------*/

		// FdPoint3d cp1_1( 0,                    0, 0),
		//           cp2_2( 0,                    0, 0),
		//           cp3_3(-l2,                   0, 0),
		//           cp4_4(-l2 * 2,               0, 0),
		//           cp5_5(-l2 * 3,               0, 0),
		//           cp6_6(-l2 * 3 - l1,          0, 0),
		//           cp7_7(-l2 * 3 - l1 - l1_bis, 0, 0);
		// FdPoint3d ZLcp_1[] = { cp1_1, cp2_2, cp2_2, cp3_3, cp3_3, cp4_4,
		//                        cp4_4, cp5_5, cp5_5, cp6_6, cp7_7 };
		double diams_sec[] = { dn1_out_ins - 2, dn1_out_ins - 2, dn1_out_ins, dn1_out_ins, dn1_out_ins + 1, dn1_out_ins + 1,
		                       dn1_out_ins + 4, dn1_out_ins + 4, dn1_out_ins, dn1_out_ins, dn1_out_ins + 2 };

		makeStraightTube(ZLcp_1, diams_sec, n, 10, true);
		makeFlatRing(cp7_7, vx, dn1_out_ins + 2, dn1_out + 2, n);

		/*-------------------------------THIRD CONNECTOR-------------------------------*/

		// FdPoint3d cp1_1_bis(dn1_out / 2, -dn1_out / 2,                        0),
		//           cp2_2_bis(dn1_out / 2, -dn1_out / 2,                        0),
		//           cp3_3_bis(dn1_out / 2, -dn1_out / 2 - l2,                   0),
		//           cp4_4_bis(dn1_out / 2, -dn1_out / 2 - l2 * 2,               0),
		//           cp5_5_bis(dn1_out / 2, -dn1_out / 2 - l2 * 3,               0),
		//           cp6_6_bis(dn1_out / 2, -dn1_out / 2 - l2 * 3 - l1,          0),
		//           cp7_7_bis(dn1_out / 2, -dn1_out / 2 - l2 * 3 - l1 - l1_bis, 0);
		// FdPoint3d ZLcp_2[] = { cp1_1_bis, cp2_2_bis, cp2_2_bis, cp3_3_bis, cp3_3_bis, cp4_4_bis,
		//                        cp4_4_bis, cp5_5_bis, cp5_5_bis, cp6_6_bis, cp7_7_bis };
		double diams_sec_3[] = { dn1_out_ins - 1, dn1_out_ins - 1, dn3_out_ins, dn3_out_ins, dn3_out_ins + 1, dn3_out_ins + 1,
		                         dn3_out_ins + 4, dn3_out_ins + 4, dn3_out_ins, dn3_out_ins, dn3_out_ins + 2 };

		makeUniVectorTube(ZLcp_2, vy, diams_sec_3, n, 10, true);
		makeFlatRing(cp7_7_bis, vy, dn3_out_ins + 2, dn3_out + 2, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeZLGZPEX()
{

	ads_real dn1_in, dn1_out, dn2_in, dn2_out, l1, l1_bis, l2, gz, dn2_2_in, dn2_2_out;

	get_val("dn1_in", dn1_in);
	get_val("dn1_out", dn1_out);
	get_val("dn2_in", dn2_in);
	get_val("dn2_out", dn2_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);
	get_val("gz", gz);
	get_val("dn2_2_in", dn2_2_in);
	get_val("dn2_2_out", dn2_2_out);

	int n = 10;
	int SL = 3;

	FdPoint3d cp1(0, 0, 0), cp2(l1_bis, 0 ,0 ), cp2_2(l1+l1_bis, 0, 0), cp3(l1+l1_bis+l2, 0, 0), cp4(l1+l1_bis+l2*2, 0, 0), cp5(l1+l1_bis+l2*3, 0, 0), 
			  cp6(l1+l1_bis+l2*3+SL, 0, 0), cp7(l1+l1_bis+l2*3+SL+gz, 0, 0), cp8(l1+l1_bis+l2*3+SL+gz*2, 0, 0), 
			  cp9(l1+l1_bis+l2*3+SL+gz*3, 0, 0), cp10(l1+l1_bis+l2*3+SL+gz*4, 0, 0), cp11(l1+l1_bis+l2*3+SL+gz*5, 0, 0), cp12(l1+l1_bis+l2*3+SL+gz*6, 0, 0), 
			  cp13(l1+l1_bis+l2*3+SL+gz*7, 0, 0), cp14(l1+l1_bis+l2*3+SL+gz*8, 0, 0), cp15(l1+l1_bis+l2*3+SL+gz*9, 0, 0), cp16(l1+l1_bis+l2*3+SL+gz*10, 0, 0), cp17(l1+l1_bis+l2*3+SL+gz*11, 0, 0);
	  
	FdPoint3d ZLcp[] = { cp1, cp2, cp2_2, cp2_2, cp3, cp3, cp4, cp4, cp5 }; 
	FdPoint3d SCR[] = { cp6, cp7, cp8, cp9, cp10, cp11, cp12, cp13, cp14, cp15, cp16, cp17 };
	
	double diams[] = { dn1_in+2, dn1_in, dn1_in, dn1_in+4, dn1_in+4, dn1_in+1, dn1_in+1, dn1_in, dn1_in }; 
	double SCRdiams_in[] = { dn2_in, dn2_2_in, dn2_in, dn2_2_in, dn2_in, dn2_2_in, dn2_in, dn2_2_in, dn2_in, dn2_2_in, dn2_in, dn2_2_in };
	double SCRdiams_out[] = { dn2_out, dn2_2_out, dn2_out, dn2_2_out, dn2_out, dn2_2_out, dn2_out, dn2_2_out, dn2_out, dn2_2_out, dn2_out, dn2_2_out, };

	makeStraightTube(ZLcp, diams, n, 8, true);
	
	makeStraightTube(SCR, SCRdiams_in, n, 11, true);
	makeStraightTube(SCR, SCRdiams_out, n, 11, true);

	makeScrew(cp5, vx, vy, dn1_out+10, SL, true, true); 
	
	double diams_1[] = { dn1_out+2, dn1_out, dn1_out, dn1_out+4, dn1_out+4, dn1_out+1, dn1_out+1, dn1_out, dn1_out };

	makeStraightTube(ZLcp, diams_1, n, 8, true);
	makeFlatRing(cp17, vx, dn2_2_in, dn2_2_out, n);
	makeFlatRing(cp1, vx, dn1_in+2, dn1_out+2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn1_out_ins = dn1_out + 2 * size;
		double dn2_out_ins = dn2_out + 2 * size;
		double dn2_2_out_ins = dn2_2_out + 2 * size;

		// int SL = 3;
		// FdPoint3d cp1  (0,                                   0, 0),
		//           cp2  (     l1_bis,                         0, 0),
		//           cp2_2(l1 + l1_bis,                         0, 0),
		//           cp3  (l1 + l1_bis + l2,                    0, 0),
		//           cp4  (l1 + l1_bis + l2 * 2,                0, 0),
		//           cp5  (l1 + l1_bis + l2 * 3,                0, 0),
		//           cp6  (l1 + l1_bis + l2 * 3 + SL,           0, 0),
		//           cp7  (l1 + l1_bis + l2 * 3 + SL + gz,      0, 0),
		//           cp8  (l1 + l1_bis + l2 * 3 + SL + gz * 2,  0, 0),
		//           cp9  (l1 + l1_bis + l2 * 3 + SL + gz * 3,  0, 0),
		//           cp10 (l1 + l1_bis + l2 * 3 + SL + gz * 4,  0, 0),
		//           cp11 (l1 + l1_bis + l2 * 3 + SL + gz * 5,  0, 0),
		//           cp12 (l1 + l1_bis + l2 * 3 + SL + gz * 6,  0, 0),
		//           cp13 (l1 + l1_bis + l2 * 3 + SL + gz * 7,  0, 0),
		//           cp14 (l1 + l1_bis + l2 * 3 + SL + gz * 8,  0, 0),
		//           cp15 (l1 + l1_bis + l2 * 3 + SL + gz * 9,  0, 0),
		//           cp16 (l1 + l1_bis + l2 * 3 + SL + gz * 10, 0, 0),
		//           cp17 (l1 + l1_bis + l2 * 3 + SL + gz * 11, 0, 0);
		// FdPoint3d ZLcp[] = { cp1, cp2, cp2_2, cp2_2, cp3, cp3, cp4, cp4, cp5 }; 
		// FdPoint3d SCR[] = { cp6, cp7, cp8, cp9, cp10, cp11, cp12, cp13, cp14, cp15, cp16, cp17 };
		double diams[] = { dn1_out_ins + 2, dn1_out_ins, dn1_out_ins, dn1_out_ins + 4, dn1_out_ins + 4,
		                   dn1_out_ins + 1, dn1_out_ins + 1, dn1_out_ins, dn1_out_ins };
		double SCRdiams[] = { dn2_out_ins, dn2_2_out_ins, dn2_out_ins, dn2_2_out_ins, dn2_out_ins, dn2_2_out_ins,
		                      dn2_out_ins, dn2_2_out_ins, dn2_out_ins, dn2_2_out_ins, dn2_out_ins, dn2_2_out_ins };

		// int n = 10;
		makeStraightTube(ZLcp, diams, n, 8, true);
		makeStraightTube(SCR, SCRdiams, n, 11, true);
		makeScrew(cp5, vx, vy, dn1_out_ins + 10, SL, true, true);

		makeFlatRing(cp1, vx, dn1_out_ins + 2, dn1_out + 2, n);
		makeFlatRing(cp17, vx, dn2_2_out_ins, dn2_2_out, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeZLGWPEX()
{

	ads_real dn1_in, dn1_out, dn2_in, dn2_out, l1, l1_bis, l2, gz_end, dn2_2_in, dn2_2_out, gz;

	get_val("dn1_in", dn1_in);
	get_val("dn1_out", dn1_out);
	get_val("dn2_in", dn2_in);
	get_val("dn2_out", dn2_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);
	get_val("gz_end", gz_end);
	get_val("dn2_2_in", dn2_2_in);
	get_val("dn2_2_out", dn2_2_out);
	get_val("gz", gz);

	int n = 10;
	int SL = 3;

	FdPoint3d cp1(0, 0, 0), cp2(l1_bis, 0 ,0 ), cp2_2(l1+l1_bis, 0, 0), cp3(l1+l1_bis+l2, 0, 0), cp4(l1+l1_bis+l2*2, 0, 0), cp5(l1+l1_bis+l2*3, 0, 0), 
			  cp6(l1+l1_bis+l2*3+SL, 0, 0), cp7(l1+l1_bis+l2*3+SL+gz_end, 0, 0), cp8(l1+l1_bis+l2*3+SL+gz_end+gz, 0, 0);
	  
	FdPoint3d ZLcp[] = { cp1, cp2, cp2_2, cp2_2, cp3, cp3, cp4, cp4, cp5 }; 
	FdPoint3d SCR[] = { cp6, cp6, cp7, cp8 };
	
	double diams[] = { dn1_in+2, dn1_in, dn1_in, dn1_in+4, dn1_in+4, dn1_in+1, dn1_in+1, dn1_in, dn1_in }; 
	double SCRdiams_in[] = { dn2_in, dn2_2_in, dn2_2_in, dn2_in };
	double SCRdiams_out[] = { dn2_out, dn2_2_out, dn2_2_out, dn2_out };

	makeStraightTube(ZLcp, diams, n, 8, true);
	
	makeStraightTube(SCR, SCRdiams_in, n, 3, true);
	makeStraightTube(SCR, SCRdiams_out, n, 3, true);

	makeScrew(cp5, vx, vy, dn1_out+10, SL, true, true); 
	
	double diams_1[] = { dn1_out+2, dn1_out, dn1_out, dn1_out+4, dn1_out+4, dn1_out+1, dn1_out+1, dn1_out, dn1_out };

	makeStraightTube(ZLcp, diams_1, n, 8, true);
	makeFlatRing(cp8, vx, dn2_in, dn2_out, n);
	makeFlatRing(cp1, vx, dn1_in+2, dn1_out+2, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn1_out_ins = dn1_out + 2 * size;
		double dn2_out_ins = dn2_out + 2 * size;
		double dn2_2_out_ins = dn2_2_out + 2 * size;

		// FdPoint3d cp1  (0,                                       0, 0),
		//           cp2  (     l1_bis,                             0, 0),
		//           cp2_2(l1 + l1_bis,                             0, 0),
		//           cp3  (l1 + l1_bis + l2,                        0, 0),
		//           cp4  (l1 + l1_bis + l2 * 2,                    0, 0),
		//           cp5  (l1 + l1_bis + l2 * 3,                    0, 0),
		//           cp6  (l1 + l1_bis + l2 * 3 + SL,               0, 0),
		//           cp7  (l1 + l1_bis + l2 * 3 + SL + gz_end,      0, 0),
		//           cp8  (l1 + l1_bis + l2 * 3 + SL + gz_end + gz, 0, 0);
		// FdPoint3d ZLcp[] = { cp1, cp2, cp2_2, cp2_2, cp3, cp3, cp4, cp4, cp5 }; 
		// FdPoint3d SCR[] = { cp6, cp6, cp7, cp8 };
		double diams[] = { dn1_out_ins + 2, dn1_out_ins, dn1_out_ins, dn1_out_ins + 4, dn1_out_ins + 4,
		                   dn1_out_ins + 1, dn1_out_ins + 1, dn1_out_ins, dn1_out_ins };
		double SCRdiams[] = { dn2_out_ins, dn2_2_out_ins, dn2_2_out_ins, dn2_out_ins };

		makeStraightTube(ZLcp, diams, n, 8, true);
		makeStraightTube(SCR, SCRdiams, n, 3, true);
		makeScrew(cp5, vx, vy, dn1_out_ins + 10, SL, true, true);

		makeFlatRing(cp1, vx, dn1_out_ins + 2, dn1_out + 2, n);
		makeFlatRing(cp8, vx, dn2_out_ins, dn2_out, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeELBGZPEX()
{
	ads_real r, alfa, dn_in, dn_out, l1, l1_bis, l2, l3, gz, dn2_in, dn2_out, dn2_2_in, dn2_2_out;

	get_val("dn_in", dn_in);
	get_val("dn_out", dn_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("gz", gz);
	get_val("dn2_in", dn2_in);
	get_val("dn2_out", dn2_out);
	get_val("dn2_2_in", dn2_2_in);
	get_val("dn2_2_out", dn2_2_out);

	get_val("r", r);
	get_val("alfa", alfa);

	r = 1.0 * dn_out;

	FdPoint3d cp1_don(0, 0, 0);

	makeDonutSection(cp1_don, vz, vy, r, dn_out - 2, alfa, 10, 10);
	makeDonutSection(cp1_don, vz, vy, r, dn_in - 2, alfa, 10, 10);

	int n = 10;

	FdPoint3d cp1(0, dn_in+1, 0), cp2(l3, dn_in+1, 0), cp3(l3+l2, dn_in+1, 0 ), cp4(l3+l2*2, dn_in+1, 0), cp5(l3+l2*3, dn_in+1, 0), cp6(l3+l2*3+l1, dn_in+1, 0), 
			  cp7(l3+l2*3+l1+l1_bis, dn_in+1, 0);

	FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };
	double diams[] = { dn_in-2, dn_in-2, dn_in, dn_in, dn_in+1, dn_in+1, dn_in+4, dn_in+4, 
					   dn_in, dn_in, dn_in+2 };

	double diams_1[] = { dn_out-2, dn_out-2, dn_out, dn_out, dn_out+1, dn_out+1, dn_out+4, dn_out+4, 
						 dn_out, dn_out, dn_out+2 };

	makeStraightTube(ZLcp, diams, n, 10, true);
	makeStraightTube(ZLcp, diams_1, n, 10, true);
	makeFlatRing(cp7, vx, dn_in + 2, dn_out + 2, n);

	/*-------------------------------SECOND CONNECTOR-------------------------------*/

	FdPoint3d cp1_1( -dn_in-1, 0, 0), cp1_1_bis(-dn_in-1, -l3, 0), cp2_2(-dn_in-1, -l3-gz, 0), cp3_3(-dn_in-1, -l3-gz*2, 0 ), cp4_4(-dn_in-1, -l3-gz*3, 0), cp5_5(-dn_in-1, -l3-gz*4, 0), cp6_6(-dn_in-1, -l3-gz*5, 0), 
			  cp7_7(-dn_in-1, -l3-gz*6, 0), cp8_8(-dn_in-1, -l3-gz*7, 0), cp9_9(-dn_in-1, -l3-gz*8, 0), cp10_10(-dn_in-1, -l3-gz*9, 0), cp11_11(-dn_in-1, -l3-gz*10, 0), cp12_12(-dn_in-1, -l3-gz*11, 0), 
			  cp13_13(-dn_in-1, -l3-gz*12, 0), cp14_14(-dn_in-1, -l3-gz*13, 0);

	int alfa2 = 270 + (int) alfa;
	double alfa_r = alfa2 * ARX_PI / 180;  // alfa * ARX_PI / 180
	FdPoint3d SCR[] = { cp1_1.rotateBy(alfa_r, vz),
	                    cp1_1_bis.rotateBy(alfa_r, vz),
	                    cp2_2.rotateBy(alfa_r, vz),
	                    cp3_3.rotateBy(alfa_r, vz),
	                    cp4_4.rotateBy(alfa_r, vz),
	                    cp5_5.rotateBy(alfa_r, vz),
	                    cp6_6.rotateBy(alfa_r, vz),
	                    cp7_7.rotateBy(alfa_r, vz),
	                    cp8_8.rotateBy(alfa_r, vz),
	                    cp9_9.rotateBy(alfa_r, vz),
	                    cp10_10.rotateBy(alfa_r, vz),
	                    cp11_11.rotateBy(alfa_r, vz),
	                    cp12_12.rotateBy(alfa_r, vz),
	                    cp13_13.rotateBy(alfa_r, vz),
	                    cp14_14.rotateBy(alfa_r, vz) };

	double SCRdiams_in[] = { dn_in-2, dn_in-2, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in };
	double SCRdiams_out[] = { dn_out-2, dn_out-2, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out };

	makeStraightTube(SCR, SCRdiams_in, n, 14, true);
	makeStraightTube(SCR, SCRdiams_out, n, 14, true);

	FdVector3d vv(vy);
	vv.rotateBy(alfa_r, vz);
	makeFlatRing(cp14_14, vv, dn2_2_in, dn2_2_out, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn_out_ins = dn_out + 2 * size;
		double dn2_out_ins = dn2_out + 2 * size;
		double dn2_2_out_ins = dn2_2_out + 2 * size;

		// r = 1.0 * dn_out;
		// FdPoint3d cp1_don(0, 0, 0);

		makeDonutSection(cp1_don, vz, vy, r, dn_out_ins - 2, alfa, 10, 10);

		// FdPoint3d cp1(0,                         dn_in + 1, 0),
		//           cp2(l3,                        dn_in + 1, 0),
		//           cp3(l3 + l2,                   dn_in + 1, 0),
		//           cp4(l3 + l2 * 2,               dn_in + 1, 0),
		//           cp5(l3 + l2 * 3,               dn_in + 1, 0),
		//           cp6(l3 + l2 * 3 + l1,          dn_in + 1, 0),
		//           cp7(l3 + l2 * 3 + l1 + l1_bis, dn_in + 1, 0);
		// FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };
		double diams[] = { dn_out_ins - 2, dn_out_ins - 2, dn_out_ins, dn_out_ins, dn_out_ins + 1, dn_out_ins + 1,
		                   dn_out_ins + 4, dn_out_ins + 4, dn_out_ins, dn_out_ins, dn_out_ins + 2 };

		// int n = 10;
		makeStraightTube(ZLcp, diams, n, 10, true);
		makeFlatRing(cp7, vx, dn_out_ins + 2, dn_out + 2, n);

		/*-------------------------------SECOND CONNECTOR-------------------------------*/

		// FdPoint3d cp1_1    (-dn_in - 1,  0,            0),
		//           cp1_1_bis(-dn_in - 1, -l3,           0),
		//           cp2_2    (-dn_in - 1, -l3 - gz,      0),
		//           cp3_3    (-dn_in - 1, -l3 - gz * 2,  0),
		//           cp4_4    (-dn_in - 1, -l3 - gz * 3,  0),
		//           cp5_5    (-dn_in - 1, -l3 - gz * 4,  0),
		//           cp6_6    (-dn_in - 1, -l3 - gz * 5,  0),
		//           cp7_7    (-dn_in - 1, -l3 - gz * 6,  0),
		//           cp8_8    (-dn_in - 1, -l3 - gz * 7,  0),
		//           cp9_9    (-dn_in - 1, -l3 - gz * 8,  0),
		//           cp10_10  (-dn_in - 1, -l3 - gz * 9,  0),
		//           cp11_11  (-dn_in - 1, -l3 - gz * 10, 0),
		//           cp12_12  (-dn_in - 1, -l3 - gz * 11, 0),
		//           cp13_13  (-dn_in - 1, -l3 - gz * 12, 0),
		//           cp14_14  (-dn_in - 1, -l3 - gz * 13, 0);
	 
		// int alfa2 = 270 + alfa;
		// double alfa_r = alfa2 * ARX_PI / 180;  // alfa * ARX_PI / 180
		// FdPoint3d SCR[] = { cp1_1.rotateBy(alfa_r, vz),
		//                     cp1_1_bis.rotateBy(alfa_r, vz),
		//                     cp2_2.rotateBy(alfa_r, vz),
		//                     cp3_3.rotateBy(alfa_r, vz),
		//                     cp4_4.rotateBy(alfa_r, vz),
		//                     cp5_5.rotateBy(alfa_r, vz),
		//                     cp6_6.rotateBy(alfa_r, vz),
		//                     cp7_7.rotateBy(alfa_r, vz),
		//                     cp8_8.rotateBy(alfa_r, vz),
		//                     cp9_9.rotateBy(alfa_r, vz),
		//                     cp10_10.rotateBy(alfa_r, vz),
		//                     cp11_11.rotateBy(alfa_r, vz),
		//                     cp12_12.rotateBy(alfa_r, vz),
		//                     cp13_13.rotateBy(alfa_r, vz),
		//                     cp14_14.rotateBy(alfa_r, vz) };
		double SCRdiams_out[] = { dn_out_ins - 2, dn_out_ins - 2, dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins,
		                          dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1,
		                          dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins };

		makeStraightTube(SCR, SCRdiams_out, n, 14, true);

		// FdVector3d vv(vy);
		// vv.rotateBy(alfa_r, vz);
		makeFlatRing(cp14_14, vv, dn2_2_out_ins, dn2_2_out, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeELBGWPEX()
{
	ads_real r, alfa, dn_in, dn_out, l1, l1_bis, l2, l3, gz, dn2_in, dn2_out, dn2_2_in, dn2_2_out;

	get_val("dn_in", dn_in);
	get_val("dn_out", dn_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("gz", gz);
	get_val("dn2_in", dn2_in);
	get_val("dn2_out", dn2_out);
	get_val("dn2_2_in", dn2_2_in);
	get_val("dn2_2_out", dn2_2_out);

	get_val("r", r);
	get_val("alfa", alfa);

	r = 1.0 * dn_out;

	FdPoint3d cp1_don(0, 0, 0);

	makeDonutSection(cp1_don, vz, vy, r, dn_out - 2, alfa, 10, 10);
	makeDonutSection(cp1_don, vz, vy, r, dn_in - 2, alfa, 10, 10);

	int n = 10;

	FdPoint3d cp1(0, dn_in+1, 0), cp2(l3, dn_in+1, 0), cp3(l3+l2, dn_in+1, 0 ), cp4(l3+l2*2, dn_in+1, 0), cp5(l3+l2*3, dn_in+1, 0), cp6(l3+l2*3+l1, dn_in+1, 0), 
			  cp7(l3+l2*3+l1+l1_bis, dn_in+1, 0);

	FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };
	double diams[] = { dn_in-2, dn_in-2, dn_in, dn_in, dn_in+1, dn_in+1, dn_in+4, dn_in+4, 
					   dn_in, dn_in, dn_in+2 };

	double diams_1[] = { dn_out-2, dn_out-2, dn_out, dn_out, dn_out+1, dn_out+1, dn_out+4, dn_out+4, 
						 dn_out, dn_out, dn_out+2 };

	makeStraightTube(ZLcp, diams, n, 10, true);
	makeStraightTube(ZLcp, diams_1, n, 10, true);
	makeFlatRing(cp7, vx, dn_in + 2, dn_out + 2, n);

	/*-------------------------------SECOND CONNECTOR-------------------------------*/

	int SL = 3;
	FdPoint3d cp1_1(-dn_in - 1,  0,                 0),
	          cp2_2(-dn_in - 1, -l3,                0),
	          cp3_3(-dn_in - 1, -l3 - SL,           0),
	          cp4_4(-dn_in - 1, -l3 - SL - gz,      0),
	          cp5_5(-dn_in - 1, -l3 - SL - gz - SL, 0);

	int alfa2 = 270 + (int) alfa;
	double alfa_r = alfa2 * ARX_PI / 180;  // alfa * ARX_PI / 180
	FdPoint3d SCR[] = { cp1_1.rotateBy(alfa_r, vz),
	                    cp2_2.rotateBy(alfa_r, vz),
	                    cp3_3.rotateBy(alfa_r, vz),
	                    cp4_4.rotateBy(alfa_r, vz),
	                    cp5_5.rotateBy(alfa_r, vz) };

	double SCRdiams_in[] = { dn_in-2, dn_in-2, dn_in+4, dn_in+4, dn_in };
	double SCRdiams_out[] = { dn_out-2, dn_out-2, dn_out+4, dn_out+4, dn_out };

	makeStraightTube(SCR, SCRdiams_in, n, 4, true);
	makeStraightTube(SCR, SCRdiams_out, n, 4, true);

	FdVector3d vv(vy);
	vv.rotateBy(alfa_r, vz);
	makeFlatRing(cp5_5, vv, dn_in, dn_out, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn_out_ins = dn_out + 2 * size;

		// r = 1.0 * dn_out;
		// FdPoint3d cp1_don(0, 0, 0);

		makeDonutSection(cp1_don, vz, vy, r, dn_out_ins - 2, alfa, 10, 10);


		// FdPoint3d cp1(0,                         dn_in + 1, 0),
		//           cp2(l3,                        dn_in + 1, 0),
		//           cp3(l3 + l2,                   dn_in + 1, 0),
		//           cp4(l3 + l2 * 2,               dn_in + 1, 0),
		//           cp5(l3 + l2 * 3,               dn_in + 1, 0),
		//           cp6(l3 + l2 * 3 + l1,          dn_in + 1, 0),
		//           cp7(l3 + l2 * 3 + l1 + l1_bis, dn_in + 1, 0);
		// FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };
		double diams[] = { dn_out_ins - 2, dn_out_ins - 2, dn_out_ins, dn_out_ins, dn_out_ins + 1, dn_out_ins + 1,
		                   dn_out_ins + 4, dn_out_ins + 4, dn_out_ins, dn_out_ins, dn_out_ins + 2 };

		// int n = 10;
		makeStraightTube(ZLcp, diams, n, 10, true);
		makeFlatRing(cp7, vx, dn_out_ins + 2, dn_out + 2, n);

		/*-------------------------------SECOND CONNECTOR-------------------------------*/

		// int SL = 3;
		// FdPoint3d cp1_1(-dn_in - 1,  0,                 0),
		//           cp2_2(-dn_in - 1, -l3,                0),
		//           cp3_3(-dn_in - 1, -l3 - SL,           0),
		//           cp4_4(-dn_in - 1, -l3 - SL - gz,      0),
		//           cp5_5(-dn_in - 1, -l3 - SL - gz - SL, 0);

		// int alfa2 = 270 + alfa;
		// double alfa_r = alfa2 * ARX_PI / 180;  // alfa * ARX_PI / 180
		// FdPoint3d SCR[] = { cp1_1.rotateBy(alfa_r, vz),
		//                     cp2_2.rotateBy(alfa_r, vz),
		//                     cp3_3.rotateBy(alfa_r, vz),
		//                     cp4_4.rotateBy(alfa_r, vz),
		//                     cp5_5.rotateBy(alfa_r, vz) };
		double SCRdiams_out[] = { dn_out_ins - 2, dn_out_ins - 2, dn_out_ins + 4, dn_out_ins + 4, dn_out_ins };

		makeStraightTube(SCR, SCRdiams_out, n, 4, true);

		// FdVector3d vv(vy);
		// vv.rotateBy(alfa_r, vz);
		makeFlatRing(cp5_5, vv, dn_out_ins, dn_out, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeTRGZPEX()
{
	ads_real dn_in, dn_out, l1, l1_bis, l2, gz, dn2_2_in, dn2_2_out;

	get_val("dn_in", dn_in);
	get_val("dn_out", dn_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);

	FdPoint3d cp( 0, 0, 0);
	double tubePar[] = { dn_in-1, dn_in-1, dn_out };
	double interTPos[] = { dn_out / 2, 0 };
	double interTPar[] = { dn_out / 2, dn_in-1, dn_in-1 };
	double ang[] = { 90, 90, 90 };
	int comp[] = { 10, 10 };
	bool opt[] = { false, false, false };

	makeTubeToTubeIntersection(cp, vx, tubePar, interTPos, interTPar, ang, comp, opt);

	double tubePar_1[] = { dn_out-1, dn_out-1, dn_out };
	double interTPar_1[] = { dn_out / 2, dn_out-1, dn_out-1 };

	makeTubeToTubeIntersection(cp, vx, tubePar_1, interTPos, interTPar_1, ang, comp, opt);

	int n = 10;

	FdPoint3d cp1(dn_out, 0, 0), cp2(dn_out, 0, 0), cp3(dn_out+l2, 0, 0 ), cp4(dn_out+l2*2, 0, 0), cp5(dn_out+l2*3, 0, 0), cp6(dn_out+l2*3+l1, 0, 0), 
			  cp7(dn_out+l2*3+l1+l1_bis, 0, 0);

	FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };

	double diams[] = { dn_in-2, dn_in-2, dn_in, dn_in, dn_in+1, dn_in+1, dn_in+4, dn_in+4, dn_in, dn_in, dn_in+2 };

	double diams_1[] = { dn_out-2, dn_out-2, dn_out, dn_out, dn_out+1, dn_out+1, dn_out+4, dn_out+4, dn_out, dn_out, dn_out+2 };
	
	makeStraightTube(ZLcp, diams, n, 10, true);
	makeStraightTube(ZLcp, diams_1, n, 10, true);

/*-------------------------------SECOND CONNECTOR-------------------------------*/

	FdPoint3d cp1_1(0, 0, 0), cp2_2(0, 0, 0), cp3_3(-l2, 0, 0 ), cp4_4(-l2*2, 0, 0), cp5_5(-l2*3, 0, 0), cp6_6(-l2*3-l1, 0, 0), cp7_7(-l2*3-l1-l1_bis, 0, 0);

	FdPoint3d ZLcp_1[] = { cp1_1, cp2_2, cp2_2, cp3_3, cp3_3, cp4_4, cp4_4, cp5_5, cp5_5, cp6_6, cp7_7 };

	makeStraightTube(ZLcp_1, diams, n, 10, true);
	makeStraightTube(ZLcp_1, diams_1, n, 10, true);

/*-------------------------------THIRD CONNECTOR-------------------------------*/
	cp1_1.set(dn_out/2, 0, 0);
	get_val("gz", gz);
	get_val("dn2_2_in", dn2_2_in);
	get_val("dn2_2_out", dn2_2_out);

	FdPoint3d cp1_1_bis  (dn_out / 2, -dn_out / 2,           0),
	          cp2_2_bis  (dn_out / 2, -dn_out / 2 - gz,      0),
	          cp3_3_bis  (dn_out / 2, -dn_out / 2 - gz * 2,  0),
	          cp4_4_bis  (dn_out / 2, -dn_out / 2 - gz * 3,  0),
	          cp5_5_bis  (dn_out / 2, -dn_out / 2 - gz * 4,  0),
	          cp6_6_bis  (dn_out / 2, -dn_out / 2 - gz * 5,  0),
	          cp7_7_bis  (dn_out / 2, -dn_out / 2 - gz * 6,  0),
	          cp8_8_bis  (dn_out / 2, -dn_out / 2 - gz * 7,  0),
	          cp9_9_bis  (dn_out / 2, -dn_out / 2 - gz * 8,  0),
	          cp10_10_bis(dn_out / 2, -dn_out / 2 - gz * 9,  0),
	          cp11_11_bis(dn_out / 2, -dn_out / 2 - gz * 10, 0),
	          cp12_12_bis(dn_out / 2, -dn_out / 2 - gz * 11, 0),
	          cp13_13_bis(dn_out / 2, -dn_out / 2 - gz * 12, 0);
	          // cp14_14_bis(dn_out / 2, -dn_out / 2 - gz * 13, 0),
	          // cp15_15_bis(dn_out / 2, -dn_out / 2 - gz * 14, 0),
	          // cp16_16_bis(dn_out / 2, -dn_out / 2 - gz * 15, 0),
	          // cp17_17_bis(dn_out / 2, -dn_out / 2 - gz * 16, 0);

	FdPoint3d SCR[] = { cp1_1_bis, cp2_2_bis, cp3_3_bis, cp4_4_bis, cp5_5_bis, cp6_6_bis, cp7_7_bis, cp8_8_bis, cp9_9_bis, cp10_10_bis, cp11_11_bis, cp12_12_bis, cp13_13_bis };
						//cp14_14_bis, cp15_15_bis, cp16_16_bis, cp17_17_bis };

	double SCRdiams_in[] = { dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1 }; //dn2_2_in, dn_in-1, dn2_2_in, dn_in-1 };
	double SCRdiams_out[] = { dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1 }; // dn2_2_out, dn_out-1, dn2_2_out, dn_out-1 };
	
	makeStraightTube(SCR, SCRdiams_in, n, 12, true);
	makeStraightTube(SCR, SCRdiams_out, n, 12, true);

	makeFlatRing(cp7, vx, dn_in + 2, dn_out + 2, n);
	makeFlatRing(cp7_7, vx, dn_in + 2, dn_out + 2, n);
	makeFlatRing(cp13_13_bis, vy, dn_in - 1, dn_out - 1, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn_out_ins = dn_out + 2 * size;
		double dn2_2_out_ins = dn2_2_out + 2 * size;

		// FdPoint3d cp(0, 0, 0);
		// double interTPos[] = { dn_out / 2, 0 };
		// double ang[] = { 90, 90, 90 };
		// int comp[] = { 10, 10 };
		// bool opt[] = { false, false, false };

		double tubePar[] = { dn_out_ins - 1, dn_out_ins - 1, dn_out };
		double interTPar[] = { dn_out / 2, dn_out_ins - 1, dn_out_ins - 1 };

		makeTubeToTubeIntersection(cp, vx, tubePar, interTPos, interTPar, ang, comp, opt);

		// FdPoint3d cp1(dn_out,                        0, 0),
		//           cp2(dn_out,                        0, 0),
		//           cp3(dn_out + l2,                   0, 0),
		//           cp4(dn_out + l2 * 2,               0, 0),
		//           cp5(dn_out + l2 * 3,               0, 0),
		//           cp6(dn_out + l2 * 3 + l1,          0, 0),
		//           cp7(dn_out + l2 * 3 + l1 + l1_bis, 0, 0);
		// FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };
		double diams[] = { dn_out_ins - 2, dn_out_ins - 2, dn_out_ins, dn_out_ins, dn_out_ins + 1, dn_out_ins + 1,
		                   dn_out_ins + 4, dn_out_ins + 4, dn_out_ins, dn_out_ins, dn_out_ins + 2 };

		// int n = 10;
		makeStraightTube(ZLcp, diams, n, 10, true);
		makeFlatRing(cp7, vx, dn_out_ins + 2, dn_out + 2, n);

		/*-------------------------------SECOND CONNECTOR-------------------------------*/

		// FdPoint3d cp1_1( 0,                    0, 0),
		//           cp2_2( 0,                    0, 0),
		//           cp3_3(-l2,                   0, 0),
		//           cp4_4(-l2 * 2,               0, 0),
		//           cp5_5(-l2 * 3,               0, 0),
		//           cp6_6(-l2 * 3 - l1,          0, 0),
		//           cp7_7(-l2 * 3 - l1 - l1_bis, 0, 0);
		// FdPoint3d ZLcp_1[] = { cp1_1, cp2_2, cp2_2, cp3_3, cp3_3, cp4_4,
		//                        cp4_4, cp5_5, cp5_5, cp6_6, cp7_7 };

		makeStraightTube(ZLcp_1, diams, n, 10, true);
		makeFlatRing(cp7_7, vx, dn_out_ins + 2, dn_out + 2, n);

		/*-------------------------------THIRD CONNECTOR-------------------------------*/

		// cp1_1.set(dn_out / 2, 0, 0);
		// get_val("gz", gz);
		// get_val("dn2_2_out", dn2_2_out);

		// FdPoint3d cp1_1_bis  (dn_out / 2, -dn_out / 2,           0),
		//           cp2_2_bis  (dn_out / 2, -dn_out / 2 - gz,      0),
		//           cp3_3_bis  (dn_out / 2, -dn_out / 2 - gz * 2,  0),
		//           cp4_4_bis  (dn_out / 2, -dn_out / 2 - gz * 3,  0),
		//           cp5_5_bis  (dn_out / 2, -dn_out / 2 - gz * 4,  0),
		//           cp6_6_bis  (dn_out / 2, -dn_out / 2 - gz * 5,  0),
		//           cp7_7_bis  (dn_out / 2, -dn_out / 2 - gz * 6,  0),
		//           cp8_8_bis  (dn_out / 2, -dn_out / 2 - gz * 7,  0),
		//           cp9_9_bis  (dn_out / 2, -dn_out / 2 - gz * 8,  0),
		//           cp10_10_bis(dn_out / 2, -dn_out / 2 - gz * 9,  0),
		//           cp11_11_bis(dn_out / 2, -dn_out / 2 - gz * 10, 0),
		//           cp12_12_bis(dn_out / 2, -dn_out / 2 - gz * 11, 0),
		//           cp13_13_bis(dn_out / 2, -dn_out / 2 - gz * 12, 0);
		// //           cp14_14_bis(dn_out / 2, -dn_out / 2 - gz * 13, 0),
		// //           cp15_15_bis(dn_out / 2, -dn_out / 2 - gz * 14, 0),
		// //           cp16_16_bis(dn_out / 2, -dn_out / 2 - gz * 15, 0),
		// //           cp17_17_bis(dn_out / 2, -dn_out / 2 - gz * 16, 0);
		// FdPoint3d SCR[] = { cp1_1_bis, cp2_2_bis, cp3_3_bis, cp4_4_bis, cp5_5_bis, cp6_6_bis, cp7_7_bis,
		//                     cp8_8_bis, cp9_9_bis, cp10_10_bis, cp11_11_bis, cp12_12_bis, cp13_13_bis };
		// //                     cp14_14_bis, cp15_15_bis, cp16_16_bis, cp17_17_bis };
		double SCRdiams_out[] = { dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins,
		                          dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins,
		                          dn_out_ins - 1 };  // dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1 };
	
		makeStraightTube(SCR, SCRdiams_out, n, 12, true);
		makeFlatRing(cp13_13_bis, vy, dn_out_ins - 1, dn_out - 1, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeTRGWPEX()
{
	ads_real dn_in, dn_out, l1, l1_bis, l2, gz, dn2_2_in, dn2_2_out;

	get_val("dn_in", dn_in);
	get_val("dn_out", dn_out);
	get_val("l1", l1);
	get_val("l1_bis", l1_bis);
	get_val("l2", l2);

	FdPoint3d cp( 0, 0, 0);
	double tubePar[] = { dn_in-1, dn_in-1, dn_out };
	double interTPos[] = { dn_out / 2, 0 };
	double interTPar[] = { dn_out / 2, dn_in-1, dn_in-1 };
	double ang[] = { 90, 90, 90 };
	int comp[] = { 10, 10 };
	bool opt[] = { false, false, false };

	makeTubeToTubeIntersection(cp, vx, tubePar, interTPos, interTPar, ang, comp, opt);

	double tubePar_1[] = { dn_out-1, dn_out-1, dn_out };
	double interTPar_1[] = { dn_out / 2, dn_out-1, dn_out-1 };

	makeTubeToTubeIntersection(cp, vx, tubePar_1, interTPos, interTPar_1, ang, comp, opt);

	int n = 10;

	FdPoint3d cp1(dn_out, 0, 0), cp2(dn_out, 0, 0), cp3(dn_out+l2, 0, 0 ), cp4(dn_out+l2*2, 0, 0), cp5(dn_out+l2*3, 0, 0), cp6(dn_out+l2*3+l1, 0, 0), 
			  cp7(dn_out+l2*3+l1+l1_bis, 0, 0);

	FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };

	double diams[] = { dn_in-2, dn_in-2, dn_in, dn_in, dn_in+1, dn_in+1, dn_in+4, dn_in+4, dn_in, dn_in, dn_in+2 };

	double diams_1[] = { dn_out-2, dn_out-2, dn_out, dn_out, dn_out+1, dn_out+1, dn_out+4, dn_out+4, dn_out, dn_out, dn_out+2 };
	
	makeStraightTube(ZLcp, diams, n, 10, true);
	makeStraightTube(ZLcp, diams_1, n, 10, true);

/*-------------------------------SECOND CONNECTOR-------------------------------*/

	FdPoint3d cp1_1(0, 0, 0), cp2_2(0, 0, 0), cp3_3(-l2, 0, 0 ), cp4_4(-l2*2, 0, 0), cp5_5(-l2*3, 0, 0), cp6_6(-l2*3-l1, 0, 0), cp7_7(-l2*3-l1-l1_bis, 0, 0);

	FdPoint3d ZLcp_1[] = { cp1_1, cp2_2, cp2_2, cp3_3, cp3_3, cp4_4, cp4_4, cp5_5, cp5_5, cp6_6, cp7_7 };

	makeStraightTube(ZLcp_1, diams, n, 10, true);
	makeStraightTube(ZLcp_1, diams_1, n, 10, true);

/*-------------------------------THIRD CONNECTOR-------------------------------*/
	cp1_1.set(dn_out/2, 0, 0);
	get_val("gz", gz);
	get_val("dn2_2_in", dn2_2_in);
	get_val("dn2_2_out", dn2_2_out);

	int SL = 3;

	FdPoint3d cp1_1_bis(dn_out/2, -dn_out/2, 0), cp2_2_bis(dn_out/2, -dn_out/2-SL, 0), cp3_3_bis(dn_out/2, -dn_out/2-SL-gz, 0 ), cp4_4_bis(dn_out/2, -dn_out/2-SL-gz-SL, 0);
	  
	FdPoint3d SCR[] = { cp1_1_bis, cp2_2_bis, cp2_2_bis, cp3_3_bis, cp4_4_bis };
	
	double SCRdiams_in[] = { dn_in-1, dn2_2_in+5, dn2_2_in+5, dn2_2_in+5, dn_in-1 }; // dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in, dn_in-1, dn2_2_in };
	double SCRdiams_out[] = { dn_out-1, dn2_2_out+5, dn2_2_out+5, dn2_2_out+5, dn_out-1 }; // dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out, dn_out-1, dn2_2_out };
	
	makeStraightTube(SCR, SCRdiams_in, n, 4, true);
	makeStraightTube(SCR, SCRdiams_out, n, 4, true);

	makeFlatRing(cp7, vx, dn_in + 2, dn_out + 2, n);
	makeFlatRing(cp7_7, vx, dn_in + 2, dn_out + 2, n);
	makeFlatRing(cp4_4_bis, vy, dn_in - 1, dn_out - 1, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double dn_out_ins = dn_out + 2 * size;
		double dn2_2_out_ins = dn2_2_out + 2 * size;

		// FdPoint3d cp(0, 0, 0);
		// double interTPos[] = { dn_out / 2, 0 };
		// double ang[] = { 90, 90, 90 };
		// int comp[] = { 10, 10 };
		// bool opt[] = { false, false, false };

		double tubePar[] = { dn_out_ins - 1, dn_out_ins - 1, dn_out };
		double interTPar[] = { dn_out / 2, dn_out_ins - 1, dn_out_ins - 1 };

		makeTubeToTubeIntersection(cp, vx, tubePar, interTPos, interTPar, ang, comp, opt);

		// FdPoint3d cp1(dn_out,                        0, 0),
		//           cp2(dn_out,                        0, 0),
		//           cp3(dn_out + l2,                   0, 0),
		//           cp4(dn_out + l2 * 2,               0, 0),
		//           cp5(dn_out + l2 * 3,               0, 0),
		//           cp6(dn_out + l2 * 3 + l1,          0, 0),
		//           cp7(dn_out + l2 * 3 + l1 + l1_bis, 0, 0);

		// FdPoint3d ZLcp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp7 };
		double diams[] = { dn_out_ins - 2, dn_out_ins - 2, dn_out_ins, dn_out_ins, dn_out_ins + 1, dn_out_ins + 1,
		                   dn_out_ins + 4, dn_out_ins + 4, dn_out_ins, dn_out_ins, dn_out_ins + 2 };

		// int n = 10;
		makeStraightTube(ZLcp, diams, n, 10, true);
		makeFlatRing(cp7, vx, dn_out_ins + 2, dn_out + 2, n);

		/*-------------------------------SECOND CONNECTOR-------------------------------*/

		// FdPoint3d cp1_1( 0,                    0, 0),
		//           cp2_2( 0,                    0, 0),
		//           cp3_3(-l2,                   0, 0),
		//           cp4_4(-l2 * 2,               0, 0),
		//           cp5_5(-l2 * 3,               0, 0),
		//           cp6_6(-l2 * 3 - l1,          0, 0),
		//           cp7_7(-l2 * 3 - l1 - l1_bis, 0, 0);
		// FdPoint3d ZLcp_1[] = { cp1_1, cp2_2, cp2_2, cp3_3, cp3_3, cp4_4,
		//                        cp4_4, cp5_5, cp5_5, cp6_6, cp7_7 };

		makeStraightTube(ZLcp_1, diams, n, 10, true);
		makeFlatRing(cp7_7, vx, dn_out_ins + 2, dn_out + 2, n);

		/*-------------------------------THIRD CONNECTOR-------------------------------*/

		// cp1_1.set(dn_out / 2, 0, 0);
		// get_val("gz", gz);
		// get_val("dn2_2_out", dn2_2_out);

		// int SL = 3;
		// FdPoint3d cp1_1_bis(dn_out / 2, -dn_out / 2,                0),
		//           cp2_2_bis(dn_out / 2, -dn_out / 2 - SL,           0),
		//           cp3_3_bis(dn_out / 2, -dn_out / 2 - SL - gz,      0),
		//           cp4_4_bis(dn_out / 2, -dn_out / 2 - SL - gz - SL, 0);
		// FdPoint3d SCR[] = { cp1_1_bis, cp2_2_bis, cp2_2_bis, cp3_3_bis, cp4_4_bis };
		double SCRdiams_out[] = { dn_out_ins - 1, dn2_2_out_ins + 5, dn2_2_out_ins + 5, dn2_2_out_ins + 5, dn_out_ins - 1 };
		//                      { dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1,
		//                        dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins, dn_out_ins - 1, dn2_2_out_ins };
	
		makeStraightTube(SCR, SCRdiams_out, n, 4, true);
		makeFlatRing(cp4_4_bis, vy, dn_out_ins - 1, dn_out - 1, n);
		};

	return 0;
}

short CGeneralBlockCreator::makePIPPEX()
{
	ads_real Dn_out, Dn_in, l;

	get_val("Dn_out", Dn_out);
	get_val("Dn_in", Dn_in);
	get_val("l", l);

	FdPoint3d cp1( - l/2, 0, 0 ), cp2( l/2, 0, 0 );
	FdPoint3d Tcp[2] = { cp1, cp2 };
	FdVector3d v[2] = { vx, vx }; 
	double diams_1[2] = { Dn_out, Dn_out };
	double diams_2[2] = { Dn_in, Dn_in };

	int n = 10;
	int seg = 1;

	makeStraightTube(Tcp, diams_1, n, 1, true);
	makeFlatRing(cp1, vx, Dn_in, Dn_out, n);

	makeStraightTube(Tcp, diams_2, n, 1, true);
	makeFlatRing(cp2, vx, Dn_in, Dn_out, n);


	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
		{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		double Dn_out_ins = Dn_out + 2 * size;

		// FdPoint3d cp1(-l / 2, 0, 0),
		//           cp2( l / 2, 0, 0);
		// FdPoint3d Tcp[2] = { cp1, cp2 };
		// FdVector3d v[2] = { vx, vx }; 
		double diams[2] = { Dn_out_ins, Dn_out_ins };

		// int n = 10;
		// int seg = 1;
		makeStraightTube(Tcp, diams, n, 1, true);
		makeFlatRing(cp1, vx, Dn_out_ins, Dn_out, n);
		makeFlatRing(cp2, vx, Dn_out_ins, Dn_out, n);
		};

	return 0;
}

short CGeneralBlockCreator::makeFANUTAC()
{
	ads_real A, B, C, D, E, F, G, H, J, K, L, type_idx, type_con_idx, function_idx, D1, d_skr_1;

	get_val("A", A); get_val("B", B); get_val("C", C); get_val("D", D); get_val("E", E); get_val("F", F); get_val("G", G); get_val("H", H); get_val("J", J); get_val("K", K); get_val("L", L),
	get_val("type_idx", type_idx), get_val("type_con_idx", type_con_idx), get_val("function_idx", function_idx), get_val("D1", D1), get_val("d_skr_1", d_skr_1);

	ads_real length, leng_conn;
	get_val("length", length); get_val("leng_conn", leng_conn);

	FdPoint3d cp1(0, 0, 0), cp2(leng_conn, 0, 0), cp2_thick(leng_conn + .1, 0, 0), cp3(leng_conn + length, 0, 0), cp3_thick(leng_conn + length + .01, 0, 0), cp4(leng_conn + length + leng_conn, 0, 0);
	FdPoint3d cpBOX_1[] = { cp1, cp2 };
	FdPoint3d cpBOX_2[] = { cp2, cp3 };
	FdPoint3d cpBOX_2_thick[] = { cp2, cp2_thick };
	FdPoint3d cpBOX_3_thick[] = { cp3, cp3_thick };
	FdPoint3d cpBOX_3[] = { cp3, cp4 };
	double Width_1[] = { F, F };
	double Width_2[] = { B, B };
	double Width_2_thick[] = { B, F };
	double Height[] = { A, A };
	bool sides[] = { true, true, true, true };
	bool sides_1[] = { true, true, true, true };
	bool sides_2[] = { false, true, true, true };

	bool conn[] = { false, false };

	double add_bracket = 50;
	double Width_bracket_1[] = { 5, 5 };
	double Height_bracket_1[] = { A + 2 * add_bracket, A + 2 * add_bracket };

	double Width_taca[] = { d_skr_1, d_skr_1 };
	double Height_taca[] = { C, C };
	bool sides_taca[] = { true, false, true, true };

	double Width_tunder[] = { B/2, B/2 };
	double Height_tunder[] = { A/8, A/8 };

	double tubeDiam[] = { K, K, J };
	double tubeDiam_1[] = { K, K, - J };

	cp2. set(leng_conn, 0, B/2 + 2.5), cp3.set( leng_conn + add_bracket, 0, B/2 + 2.5);
	FdPoint3d cpBOX_br_1[] = { cp2, cp3 };
	
	makeBox(1, cpBOX_br_1, Width_bracket_1, Height_bracket_1, sides, conn, true, true);

	cp3.set(leng_conn + length, 0, B/2 + 2.5), cp4.set(leng_conn + length - add_bracket, 0 , B/2 + 2.5);
	FdPoint3d cpBOX_br_2[] = { cp3, cp4 };

	makeBox(1, cpBOX_br_2, Width_bracket_1, Height_bracket_1, sides, conn, true, true);

	cp2.set(leng_conn + add_bracket, -A/2 - A/16, 0); 
	FdPoint3d cp6(leng_conn + add_bracket + length/4, -A/2 - A/16, 0);
		
	FdPoint3d cpBOX_tunder[] = { cp2, cp6 };

	makeBox(1, cpBOX_tunder, Width_tunder, Height_tunder, sides, conn, true, true);

	//TACA NA SKROPLINY I PRZYЈҐCZA DO RUREK I SKROPLINY

	cp4.set(leng_conn + length - 255, -A/2 - C/2, -B/2 + 10); 
	FdPoint3d cp5(leng_conn + length - 385, -A/2 - C/2, -B/2 + 10);
	FdPoint3d cpBOX_taca[] = { cp4, cp5 };
	
	makeBox(1, cpBOX_taca, Width_taca, Height_taca, sides_taca, conn, true, true);

	FdPoint3d cp7(leng_conn + length - 267.5 - D1, -A/2 - 7, -B/2 + 30);

	FdPoint3d SymbCP(leng_conn + length/4, 0, B/2);
	FdPoint3d SymbCP_1(leng_conn + length - length/4, 0, B/2);

	FdPoint3d cpSkroplin_1(leng_conn + length - 385, -A/2 - C + 55, - B/2 + 10), cpSkroplin_2(leng_conn + length - 395, -A/2 - C + 55, - B/2 + 10);
	FdPoint3d cpSkroplin[] = { cpSkroplin_1, cpSkroplin_2 };

	makeSimpleTube(cpSkroplin, d_skr_1, d_skr_1, 10);

	if(type_idx == 1 || type_idx == 2){
		makeGrillType6(cp1, vx, F - 60, A - 60, 20, 5);}


	short ftype;
	short elType;

	get_val("elType", elType);
	get_val("ftype", ftype);

	switch( elType ) {
		case 0:
			makeHSym(SymbCP, vz, vx, length/10, ftype);
				makeVent(SymbCP_1, vz, vx, length/10, function_idx != 0.0 ? true : false);
			SymbCP.z = -B / 2;
			SymbCP_1.z = -B / 2;
			makeHSym(SymbCP, vz, vx, length/10, ftype);
				makeVent(SymbCP_1, vz, vx, length/10, function_idx != 0.0 ? true : false);
			break;
		case 1:
			makeHSym(SymbCP, vz, vx, length/10, ftype);
				makeVent(SymbCP_1, vz, vx, length/10, function_idx != 0.0 ? true : false);
			SymbCP.z = -B / 2;
			SymbCP_1.z = -B / 2;
			makeHSym(SymbCP, vz, vx, length/10, ftype);
				makeVent(SymbCP_1, vz, vx, length/10, function_idx != 0.0 ? true : false);
			break;
		case 2:
			makeHSym(SymbCP, vz, vx, length/10, ftype);
				makeVent(SymbCP_1, vz, vx, length/10, function_idx != 0.0 ? true : false);
			SymbCP.z = -B / 2;
			SymbCP_1.z = -B / 2;
			makeHSym(SymbCP, vz, vx, length/10, ftype);
				makeVent(SymbCP_1, vz, vx, length/10, function_idx != 0.0 ? true : false);
			break;}

	if(function_idx == 1){
	cp4.set(leng_conn + length - 267.5 - D1, -A/2, -B/2 + 30); 
	FdPoint3d cpTube_1[] = { cp4, cp7 };

	makeSimpleTube(cpTube_1, D1, D1, 10);

	cp4.set(leng_conn + length - 372.5 + D1, -A/2, -B/2 + 30), 
	cp7.set(leng_conn + length - 372.5 + D1, -A/2 - 7, -B/2 + 30);
	FdPoint3d cpTube_2[] = { cp4, cp7 };

	makeSimpleTube(cpTube_2, D1, D1, 10);}else if(function_idx == 2){

	cp4.set(leng_conn + length - 267.5 - D1, -A/2, -B/2 + 30); 
	FdPoint3d cpTube_1[] = { cp4, cp7 };

	makeSimpleTube(cpTube_1, D1, D1, 10);

	cp4.set(leng_conn + length - 372.5 + D1, -A/2, -B/2 + 30), 
	cp7.set(leng_conn + length - 372.5 + D1, -A/2 - 7, -B/2 + 30);
	FdPoint3d cpTube_2[] = { cp4, cp7 };

	makeSimpleTube(cpTube_2, D1, D1, 10);

	cp4.set(leng_conn + length - 267.5 - D1, -A/2, -B/2 + 60), 
	cp7.set(leng_conn + length - 267.5 - D1, -A/2 - 7, -B/2 + 60);
	FdPoint3d cpTube_3[] = { cp4, cp7 };

	makeSimpleTube(cpTube_3, D1, D1, 10);

	cp4.set(leng_conn + length - 372.5 + D1, -A/2, -B/2 + 60), 
	cp7.set(leng_conn + length - 372.5 + D1, -A/2 - 7, -B/2 + 60);
	FdPoint3d cpTube_4[] = { cp4, cp7 };

	makeSimpleTube(cpTube_4, D1, D1, 10);}

	if (type_idx == 1){
	//main box and rectangular connectors & inst bracket

	makeBox(1, cpBOX_1, Width_1, Height, sides, conn, false, false);
	makeBox(1, cpBOX_2, Width_2, Height, sides_1, conn, false, false);
	
	makeBox(1, cpBOX_3, Width_1, Height, sides, conn, false, false);

	makeBox(1, cpBOX_2_thick, Width_2_thick, Height, sides, conn, false, false);
	makeBox(1, cpBOX_3_thick, Width_2_thick, Height, sides, conn, false, true);

	}else if(type_idx == 2){

	makeBox(1, cpBOX_1, Width_1, Height, sides, conn, false, false);
	makeBox(1, cpBOX_2, Width_2, Height, sides_1, conn, false, false);
	
	makeBox(1, cpBOX_2_thick, Width_2_thick, Height, sides, conn, false, false);

	cp3.set(leng_conn + length - 130, -A/2, 0);
	FdPoint3d cp8(leng_conn + length - 130, -A/2 - J, 0); 
	FdPoint3d cp_tube_vent_1[] = { cp3, cp8 };

	makeSimpleTube(cp_tube_vent_1, K, K, 10);

	cp3.set(leng_conn + length - 130, A/2, 0);
	cp8.set(leng_conn + length - 130, A/2 + J, 0); 
	FdPoint3d cp_tube_vent_2[] = { cp3, cp8 };
	
	makeSimpleTube(cp_tube_vent_2, K, K, 10);

	if(type_con_idx == 1){
	double TubeHeight_1[] = { B, A };
	cp3.set(leng_conn + length, 0, 0);

	makeRectToTubeTransition(cp3, vx, vz, TubeHeight_1, cp3, tubeDiam, 10);}

	else if(type_con_idx == 2){

	double TubeHeight_2[] = { B, A/2 };
	cp3.set(leng_conn + length, A/4, 0);

	makeRectToTubeTransition(cp3, vx, vz, TubeHeight_2, cp3, tubeDiam, 10);

	cp3.set(leng_conn + length, -A/4, 0);

	makeRectToTubeTransition(cp3, vx, vz, TubeHeight_2, cp3, tubeDiam, 10);}

	}else if(type_idx == 3){
	makeBox(1, cpBOX_2, Width_2, Height, sides_1, conn, false, false);

	double TubeHeight_2[] = { B, A/2 };
	cp3.set(leng_conn + length, A/4, 0);

	makeRectToTubeTransition(cp3, vx, vz, TubeHeight_2, cp3, tubeDiam, 10);

	cp3.set(leng_conn + length, -A/4, 0);

	makeRectToTubeTransition(cp3, vx, vz, TubeHeight_2, cp3, tubeDiam, 10);

	cp3.set(leng_conn, -A/4, 0);

	makeRectToTubeTransition(cp3, vx, vz, TubeHeight_2, cp3, tubeDiam_1, 10);

	cp3.set(leng_conn, A/4, 0);

	makeRectToTubeTransition(cp3, vx, vz, TubeHeight_2, cp3, tubeDiam_1, 10);

	}else if (type_idx == 4){

	makeBox(1, cpBOX_2, Width_2, Height, sides_2, conn, true, true);

	cp2.set(leng_conn + 130, A/2, 0), cp3.set(leng_conn + length - 130, A/2, 0);
	FdPoint3d cp_rect_start_1(leng_conn + length/4, A/2, 0), cp_rect_start_2(leng_conn + length - length/4, A/2, 0);
	double TubeHeight_LEFT[] = { B, length/2 };
	double tubeD[] = { K, K, add_bracket };
	makeRectToTubeTransition(cp_rect_start_1, vy, vz, TubeHeight_LEFT, cp2, tubeD, 10);
	
	makeRectToTubeTransition(cp_rect_start_2, vy, vz, TubeHeight_LEFT, cp3, tubeD, 10);
	}

	return 0;
}

short CGeneralBlockCreator::makeAQ()
{
	ads_real L, H, W, DN, DN1, DN2;

	get_val("L", L); get_val("H", H); get_val("W", W); get_val("DN", DN); get_val("DN1", DN1); get_val("DN2", DN2);

	double sides_box_L = 150;
	int n = 10;

	FdPoint3d cp(0, 0, 0), cp1(W / 2, 0, 0);
	FdPoint3d cp_front_1[] = { cp, cp1 };
	double Width_front_1[] = { L - 2 * sides_box_L, L - 2 *sides_box_L };
	double Height_front_1[] = { H - 300, H - 300 };
	bool sides[] = { true, true, true, true };
	bool conn[] = { false, false };

	makeBox(1, cp_front_1, Height_front_1, Width_front_1, sides, conn, true, true);

	FdPoint3d cp3(W, 0, 150);
	cp1.set(W / 2, 0, 150);
	FdPoint3d cp_back_1[] = { cp3, cp1 };
	double Height_back_1[] = { H, H };

	makeBox(1, cp_back_1, Height_back_1, Width_front_1, sides, conn, true, true);

	FdPoint3d cpT1_in(W - DN - 50, 0, H / 2 + 150), cpT2_in(W - DN - 50, 0, H / 2 + 205);
	FdPoint3d cp_t1_in[] = { cpT1_in, cpT2_in };

	makeSimpleTube(cp_t1_in, DN, DN, n);

	FdPoint3d cpT1_out(W, 0, - H / 2 + 300 + DN1 + 50), cpT2_out(W + 55, 0, - H / 2 + 300 + DN1 + 50);
	FdPoint3d cp_t1_out[] = { cpT1_out, cpT2_out };

	makeSimpleTube(cp_t1_out, DN1, DN1, n);
	// sides without one wall
	// first one
	double Width_side_1[] = { sides_box_L - 100, sides_box_L - 100 };
	double Height_side_2[] = { H - 500, H - 500 };
	bool sides_1[] = { false, true, false, true };

	FdPoint3d cp_side_down_1(0, - (L - sides_box_L - 100) / 2, 100),
			  cp_side_down_2(W / 2, - (L - sides_box_L - 100) / 2, 100);
	
	FdPoint3d cp_side_down[] = { cp_side_down_1, cp_side_down_2 };	
	makeBox(1, cp_side_down, Height_side_2, Width_side_1, sides_1, conn, true, true);

	//second one
	double Height_side_1[] = { H - 500, H - 500 };
	FdPoint3d cp_side_up_1(0, (L - sides_box_L - 100) / 2, 100),
			  cp_side_up_2(W / 2, (L - sides_box_L - 100) / 2, 100);

	FdPoint3d cp_side_up[] = { cp_side_up_1, cp_side_up_2 };
	makeBox(1, cp_side_up, Height_side_1, Width_side_1, sides_1, conn, true, true);

	// third one
	double Height_side_back[] = { H - 200, H - 200 };
	FdPoint3d cp4(W, - (L - sides_box_L - 100) / 2, 250);
	cp1.set(W / 2, - (L - sides_box_L - 100) / 2, 250);

	FdPoint3d  cp_side_down_back[] = { cp4, cp1 };
	makeBox(1, cp_side_down_back, Height_side_back, Width_side_1, sides_1, conn, true, true);

	// fourth one
	FdPoint3d cp5(W, (L - sides_box_L - 100) / 2, 250);
	cp1.set(W / 2, (L - sides_box_L - 100) / 2, 250);

	FdPoint3d  cp_side_down_back_1[] = { cp5, cp1 };
	makeBox(1, cp_side_down_back_1, Height_side_back, Width_side_1, sides_1, conn, true, true);

	//bottom one
	double Height_bottom_up[] = { 350, 350 };
	bool sides_2[] = { false, true, true, true };
	FdPoint3d cp6(0, (L - sides_box_L - 100) / 2, - H / 2 + 175), cp7(W, (L - sides_box_L - 100) / 2, - H / 2 + 175);
	FdPoint3d cp_bottom_up[] = { cp6, cp7 };
	makeBox(1, cp_bottom_up, Height_bottom_up, Width_side_1, sides_2, conn, true, true);

	bool sides_3[] = { true, false, false, true };
	FdPoint3d cp8(0, - (L - sides_box_L - 100) / 2, - H / 2 + 175), cp9(W, - (L - sides_box_L - 100) / 2, - H / 2 + 175);
	FdPoint3d cp_bottom_up_2[] = { cp8, cp9 };
	makeBox(1, cp_bottom_up_2, Height_bottom_up, Width_side_1, sides_3, conn, true, true);

	FdPoint3d cpT(-150, 0, 0); cp1.set(0,0,0);
	FdPoint3d cpTube[] = { cp1, cpT };
	makeSimpleTube(cpTube, L - 380, L - 380, 10);

	cp1.set( - 5, 0, 0);
	makeGrillType1(cp1, vz, L / 100, L - 380, L - 380, 10, 10, 12);

	double d1_eng = 150;
	double d1_small = 50;
	double d1_middle = 80;

	FdPoint3d cp1_eng(20, 0, H / 2 - 370 + 2 * d1_eng), cp2_eng(60, 0, H / 2 - 370  + 2 * d1_eng), cp3_eng(100, 0, H / 2 - 370 + 2 * d1_eng), cp4_eng(300, 0, H / 2 - 370 + 2 * d1_eng);
	FdPoint3d cp_engine[] = { cp1_eng, cp2_eng, cp2_eng, cp3_eng, cp3_eng, cp4_eng };
	double diams[] = { d1_small, d1_small, d1_middle, d1_middle, d1_eng, d1_eng };
	int numS = 5;

	makeStraightTube(cp_engine, diams, n, numS, true);
	makeFlatRing(cp1_eng, vx, 0, d1_small, n);

	double latAng[] = { 0, 180};
	double longAng[] = { 0, 360 };
	double diamsS[] = { d1_eng, d1_eng, d1_eng };
	int nS[] = { 10, 10 };

	makeSpheroidSection(cp4_eng, vx, latAng, longAng, diamsS, nS);

	return 0;
}

short CGeneralBlockCreator::makeMD_TS()
{
	ads_real A, B, H, DN;

	get_val("A", A); get_val("B", B); get_val("H", H); get_val("DN", DN);

	FdPoint3d cp1(0, 0, 0), cp2(0, 0, H - 200);
	FdPoint3d cpBOX[] = { cp1, cp2 };
	double Width[] = { A, A };
	double Height[] = { B, B };
	bool sides[] = { true, true, true, true };
	bool conn[] = { true, false };

	makeBox(1, cpBOX, Height, Width, sides, conn, true, false);	

	int n = 10;
	double tubePar[] = { B - 500, B - 500, 200 };
	double width[] = { A, B };
	makeRectToTubeTransition(cp2, vz, vx, width, cp2, tubePar, n);
	
	makeGrillType1(cp2, vx, vz, 20, B-500, B-500, 30, n, 12);

	FdPoint3d cp_T1_IN(A / 2, 0, 600), cp_T2_IN(A / 2 + 55, 0, 600);
	FdPoint3d cp_tube_in[] = { cp_T1_IN, cp_T2_IN };

	makeSimpleTube( cp_tube_in, DN, DN, n);

	FdPoint3d cp_T1_OUT(A / 2, 0, H - 600), cp_T2_OUT(A / 2 + 55, 0, H - 600);
	FdPoint3d cp_tube_out[] = { cp_T1_OUT, cp_T2_OUT };

	makeSimpleTube( cp_tube_out, DN, DN, n);

	return 0;
}

short CGeneralBlockCreator::makeNC_18()
{
	ads_real A, B, H, DN;

	get_val("A", A); get_val("B", B); get_val("H", H); get_val("DN", DN);

	FdPoint3d cp1(0, 0, 0), cp2(0, 0, H);
	FdPoint3d cpBOX[] = { cp1, cp2 };
	double Width[] = { A, A };
	double Height[] = { B, B };
	bool sides[] = { true, true, true, true };
	bool conn[] = { true, false };

	makeBox(1, cpBOX, Height, Width, sides, conn, true, false);	

	int n = 10;
	double tubePar[] = { B - 500, B - 500, 0 };
	double width[] = { A, B };
	makeRectToTubeTransition(cp2, vz, vx, width, cp2, tubePar, n);
	
	makeGrillType1(cp2, vx, vz, 20, B-500, B-500, 30, n, 12);

	FdPoint3d cp_T1_IN(0, B / 2, H - 600), cp_T2_IN(0, B / 2 + 35, H - 600);
	FdPoint3d cp_T1_OUT(0, B / 2, 600), cp_T2_OUT(0, B / 2 + 35, 600);
	FdPoint3d cp_tube_in[] = { cp_T1_IN, cp_T2_IN };
	FdPoint3d cp_tube_out[] = { cp_T1_OUT, cp_T2_OUT };

	makeSimpleTube(cp_tube_in, DN, DN, n);
	makeSimpleTube(cp_tube_out, DN, DN, n);

	FdPoint3d cp1_down_left(- A / 2 + 100, - B / 2 + 100, H), cp2_down_left(- A / 2 + 100, - B / 2 + 100, H + 400),
			  cp1_down_right(A / 2 - 100, - B / 2 + 100, H), cp2_down_right(A / 2 - 100, - B / 2 + 100, H + 400),
			  cp1_up_left(- A / 2 + 100, B / 2 - 100, H), cp2_up_left(- A / 2 + 100, B / 2 - 100, H + 400),
			  cp1_up_right(A / 2 - 100, B / 2 - 100, H), cp2_up_right(A / 2 - 100, B / 2 - 100, H + 400),

			  cp1_middle_left(- A / 2 + 100, 0, H), cp2_middle_left(- A / 2 + 100, 0, H + 400),
			  cp1_middle_right(A / 2 - 100, 0, H), cp2_middle_right(A / 2 - 100, 0, H + 400),
			  cp1_up_middle(0, B / 2 - 100, H), cp2_up_middle(0, B / 2 - 100, H + 400),
			  cp1_down_middle(0, - B / 2 + 100, H), cp2_down_middle(0, - B / 2 + 100, H + 400);
	
	FdPoint3d cp_down_left[] = { cp1_down_left, cp2_down_left };
	FdPoint3d cp_down_right[] = { cp1_down_right, cp2_down_right };
	FdPoint3d cp_up_left[] = { cp1_up_left, cp2_up_left };
	FdPoint3d cp_up_right[] = { cp1_up_right, cp2_up_right };

	FdPoint3d cp_middle_left[] = { cp1_middle_left, cp2_middle_left };
	FdPoint3d cp_middle_right[] = { cp1_middle_right, cp2_middle_right };
	FdPoint3d cp_up_middle[] = { cp1_up_middle, cp2_up_middle };
	FdPoint3d cp_down_middle[] = { cp1_down_middle, cp2_down_middle };

	double dn = 50;
	makeSimpleTube(cp_down_left, dn, dn, n);
	makeSimpleTube(cp_down_right, dn, dn, n);
	makeSimpleTube(cp_up_left, dn, dn, n);
	makeSimpleTube(cp_up_right, dn, dn, n);

	makeSimpleTube(cp_middle_left, dn, dn, n);
	makeSimpleTube(cp_middle_right, dn, dn, n);
	makeSimpleTube(cp_up_middle, dn, dn, n);
	makeSimpleTube(cp_down_middle, dn, dn, n);

	FdPoint3d cp1_tube(- A / 2 + 50, - B / 2 + 150, H + 200), cp2_tube(- A / 2 + 50, B / 2 - 50, H + 200), cp3_tube( A / 2 - 50, B / 2 - 50, H + 200), cp4_tube( A / 2 - 50, - B / 2 + 50, H + 200),
			  cp5_tube(- A / 2 + 50, - B / 2 + 50, H + 200), cp6_tube(- A / 2 + 50, - B / 2 + 150, H + 200);
	FdPoint3d cp_tube[] = { cp1_tube, cp2_tube, cp3_tube, cp4_tube, cp5_tube, cp6_tube };

	FdPoint3d cp1_tube_up(- A / 2 + 50, - B / 2 + 150, H + 375), cp2_tube_up(- A / 2 + 50, B / 2 - 50, H + 375), cp3_tube_up( A / 2 - 50, B / 2 - 50, H + 375), cp4_tube_up( A / 2 - 50, - B / 2 + 50, H + 375),
			  cp5_tube_up(- A / 2 + 50, - B / 2 + 50, H + 375), cp6_tube_up(- A / 2 + 50, - B / 2 + 150, H + 375);
	FdPoint3d cp_tube_up[] = { cp1_tube_up, cp2_tube_up, cp3_tube_up, cp4_tube_up, cp5_tube_up, cp6_tube_up };
	int nseg = 5;

	makeElbowedTube(cp_tube, dn, n, nseg, true);
	makeElbowedTube(cp_tube_up, dn, n, nseg, true);

	return 0;
}

short CGeneralBlockCreator::makeAV_18()
{
	ads_real A, B, H, DN;

	get_val("A", A); get_val("B", B); get_val("H", H); get_val("DN", DN);

	double thick = 50;

	FdPoint3d cp1_front(0, 0, 0), cp2_front(0, 0, H - 500);
	FdPoint3d CP_FRONT[] = { cp1_front, cp2_front };
	double Width[] = { A, A };
	double Height[] = { B / 2, B / 2 };
	bool sides[] = { true, true, true, true };
	bool conn[] = { true, false };

	makeBox(1, CP_FRONT, Width, Height, sides, conn, true, false);

	FdPoint3d cp1_front_small(- B / 4 - thick / 2, A / 4, 0), cp2_front_small(- B / 4 - thick / 2, A / 4, H - 500);
	FdPoint3d cp3_front_small(- B / 4 - thick / 2, - A / 4, 0), cp4_front_small(- B / 4 - thick / 2, - A / 4, H - 500);
		
	FdPoint3d cp5_front_small(0, A / 2 + thick / 2, 0), cp6_front_small(0, A / 2 + thick / 2, H - 500);
	FdPoint3d cp7_front_small(0, - A / 2 - thick / 2, 0), cp8_front_small(0, - A / 2 - thick / 2, H - 500);

	FdPoint3d cp9_front_small(B / 2, A / 2 + thick / 2, 0), cp10_front_small(B / 2, A / 2 + thick / 2, H - 500);
	FdPoint3d cp11_front_small(B / 2, - A / 2 - thick / 2, 0), cp12_front_small(B / 2, - A / 2 - thick / 2, H - 500);
	
	FdPoint3d CP_FRONT_SMALL[] = { cp1_front_small, cp2_front_small };
	FdPoint3d CP_FRONT_SMALL_2[] = { cp3_front_small, cp4_front_small };
	FdPoint3d CP_FRONT_SMALL_3[] = { cp5_front_small, cp6_front_small };
	FdPoint3d CP_FRONT_SMALL_4[] = { cp7_front_small, cp8_front_small };
	FdPoint3d CP_FRONT_SMALL_5[] = { cp9_front_small, cp10_front_small };
	FdPoint3d CP_FRONT_SMALL_6[] = { cp11_front_small, cp12_front_small };

	double Width_s[] = { A / 2, A / 2 };
	double Width_s_2[] = { B / 2, B / 2 };
	double Height_s[] = { - thick, - thick };
	bool sides_s[] = { false, true, false, true };
	bool sides_s_2[] = { true, false, true, false };
	bool conn_s[] = { false, false }; 

	makeBox(1, CP_FRONT_SMALL, Width_s, Height_s, sides_s, conn_s, true, true);
	makeBox(1, CP_FRONT_SMALL_2, Width_s, Height_s, sides_s, conn_s, true, true);

	makeBox(1, CP_FRONT_SMALL_3, Height_s, Width_s_2, sides_s_2, conn_s, true, true);
	makeBox(1, CP_FRONT_SMALL_4, Height_s, Width_s_2, sides_s_2, conn_s, true, true);

	makeBox(1, CP_FRONT_SMALL_5, Height_s, Width_s_2, sides_s_2, conn_s, true, true);
	makeBox(1, CP_FRONT_SMALL_6, Height_s, Width_s_2, sides_s_2, conn_s, true, true);

	cp1_front.set(B / 2, 0, 0);
	FdPoint3d cp2_back(B / 2, 0, H);
	FdPoint3d CP_BACK[] = { cp1_front, cp2_back };

	makeBox(1, CP_BACK, Width, Height, sides, conn, true, true);

	FdPoint3d cpRectToT(0, A / 4, H - 500);
	FdPoint3d cpRectToT_2(0, - A / 4, H - 500);
	double heightW[] = { B / 2, A / 2 };
	double tubeDiam[] = { B / 2 - 300, B / 2 - 300, 500 };
	int n = 10;

	makeRectToTubeTransition(cpRectToT, vz, vx, heightW, cpRectToT, tubeDiam, n);
	makeGrillType1(cpRectToT, vx, vz, 20, B / 2 - 300, B / 2 - 300, 30, n, 12);
	makeRectToTubeTransition(cpRectToT_2, vz, vx, heightW, cpRectToT_2, tubeDiam, n);
	makeGrillType1(cpRectToT_2, vx, vz, 20, B / 2 - 300, B / 2 - 300, 30, n, 12);

	FdPoint3d cp1_IN(B - B / 4 - DN - 50, 0, H), cp2_IN(B - B / 4 - DN - 50, 0, H + 55);
	FdPoint3d cp_IN[] = { cp1_IN, cp2_IN };

	makeSimpleTube(cp_IN, DN, DN, 10);

	FdPoint3d cp1_OUT(B - B / 4, 0, DN + 50), cp2_OUT(B - B / 4 + 55, 0, DN + 50);
	FdPoint3d cp_OUT[] = { cp1_OUT, cp2_OUT };

	makeSimpleTube(cp_OUT, DN, DN, 10);

	return 0;
}

short CGeneralBlockCreator::makeMW_07()
{
	ads_real A, B, H, DN;

	get_val("A", A); get_val("B", B); get_val("H", H); get_val("DN", DN);

	double thick = 50;

	FdPoint3d cp1_front(0, 0, 0), cp2_front(0, 0, H - 500);
	FdPoint3d CP_FRONT[] = { cp1_front, cp2_front };
	double Width[] = { A, A };
	double Height[] = { B, B };
	bool sides[] = { true, true, true, true };
	bool conn[] = { true, false };

	makeBox(1, CP_FRONT, Width, Height, sides, conn, true, false);

	FdPoint3d cp1_front_wall(- B / 2 - thick / 2, 0, 0), cp2_front_wall(- B / 2 - thick / 2, 0, H * 0.8 - 500);
	FdPoint3d cp1_1_front_wall(B / 2 + thick / 2, 0, 0), cp2_2_front_wall(B / 2 + thick / 2, 0, H * 0.8 - 500);

	FdPoint3d cp1_2_front_wall(0, - A / 2 - thick / 2, 0), cp1_3_front_wall(0, - A / 2 - thick / 2, H * 0.8 - 500);
	FdPoint3d cp1_4_front_wall(0, A / 2 + thick / 2, 0), cp1_5_front_wall(0, A / 2 + thick / 2, H * 0.8 - 500);

	FdPoint3d CP_FRONT_WALL[] = { cp1_front_wall, cp2_front_wall };
	FdPoint3d CP_FRONT_WALL_1_1[] = { cp1_1_front_wall, cp2_2_front_wall };

	FdPoint3d CP_FRONT_WALL_2_2[] = { cp1_2_front_wall, cp1_3_front_wall };
	FdPoint3d CP_FRONT_WALL_3_3[] = { cp1_4_front_wall, cp1_5_front_wall };

	double Height_s[] = { - thick, - thick };
	double Height_s_1[] = { thick, thick };
	bool sides_s[] = { false, true, false, true };
	bool sides_s_1[] = { true, false, true, false };
	bool conn_s[] = { false, false };

	makeBox(1, CP_FRONT_WALL, Width, Height_s, sides_s, conn_s, true, true);
	makeBox(1, CP_FRONT_WALL_1_1, Width, Height_s_1, sides_s, conn_s, true, true);

	makeBox(1, CP_FRONT_WALL_2_2, Height_s_1, Height, sides_s_1, conn_s, true, true);
	makeBox(1, CP_FRONT_WALL_3_3, Height_s, Height, sides_s_1, conn_s, true, true);

	FdPoint3d cp3_front_wall(- B / 2 - thick / 2, A / 4,  H * 0.8 - 500), cp4_front_wall(- B / 2 - thick / 2, A / 4, H - 500);
	FdPoint3d cp5_front_wall(- B / 2 - thick / 2, - A / 4,  H * 0.8 - 500), cp6_front_wall(- B / 2 - thick / 2, - A / 4, H - 500);

	FdPoint3d cp7_front_wall(B / 2 + thick / 2, A / 4,  H * 0.8 - 500), cp8_front_wall(B / 2 + thick / 2, A / 4, H - 500);
	FdPoint3d cp9_front_wall(B / 2 + thick / 2, - A / 4,  H * 0.8 - 500), cp10_front_wall(B / 2 + thick / 2, - A / 4, H - 500);

	FdPoint3d cp11_front_wall(B / 4, - A / 2 - thick / 2,  H * 0.8 - 500), cp12_front_wall(B / 4, - A / 2 - thick / 2, H - 500);
	FdPoint3d cp13_front_wall(- B / 4, - A / 2 - thick / 2,  H * 0.8 - 500), cp14_front_wall(- B / 4, - A / 2 - thick / 2, H - 500);

	FdPoint3d cp15_front_wall(B / 4, A / 2 + thick / 2,  H * 0.8 - 500), cp16_front_wall(B / 4, A / 2 + thick / 2, H - 500);
	FdPoint3d cp17_front_wall(- B / 4, A / 2 + thick / 2,  H * 0.8 - 500), cp18_front_wall(- B / 4, A / 2 + thick / 2, H - 500);

	FdPoint3d CP_FRONT_WALL_2[] = { cp3_front_wall, cp4_front_wall };
	FdPoint3d CP_FRONT_WALL_3[] = { cp5_front_wall, cp6_front_wall };

	FdPoint3d CP_FRONT_WALL_4[] = { cp7_front_wall, cp8_front_wall };
	FdPoint3d CP_FRONT_WALL_5[] = { cp9_front_wall, cp10_front_wall };

	FdPoint3d CP_FRONT_WALL_6[] = { cp11_front_wall, cp12_front_wall };
	FdPoint3d CP_FRONT_WALL_7[] = { cp13_front_wall, cp14_front_wall };

	FdPoint3d CP_FRONT_WALL_8[] = { cp15_front_wall, cp16_front_wall };
	FdPoint3d CP_FRONT_WALL_9[] = { cp17_front_wall, cp18_front_wall };

	double Width_s[] = { A / 2, A / 2 };
	double Width_s_1[] = { B / 2, B / 2 };

	makeBox(1, CP_FRONT_WALL_2, Width_s, Height_s, sides_s, conn_s, false, true);
	makeBox(1, CP_FRONT_WALL_3, Width_s, Height_s, sides_s, conn_s, false, true);
	
	makeBox(1, CP_FRONT_WALL_4, Width_s, Height_s, sides_s, conn_s, false, true);
	makeBox(1, CP_FRONT_WALL_5, Width_s, Height_s, sides_s, conn_s, false, true);

	makeBox(1, CP_FRONT_WALL_6, Height_s, Width_s_1, sides_s_1, conn_s, false, true);
	makeBox(1, CP_FRONT_WALL_7, Height_s, Width_s_1, sides_s_1, conn_s, false, true);

	makeBox(1, CP_FRONT_WALL_8, Height_s, Width_s_1, sides_s_1, conn_s, false, true);
	makeBox(1, CP_FRONT_WALL_9, Height_s, Width_s_1, sides_s_1, conn_s, false, true);

	FdPoint3d cpRectToT_1(B / 4, A / 4, H - 500);
	FdPoint3d cpRectToT_2(- B / 4, - A / 4, H - 500);

	FdPoint3d cpRectToT_3(- B / 4, A / 4, H - 500);
	FdPoint3d cpRectToT_4(B / 4, - A / 4, H - 500);

	double heightW[] = { B / 2, A / 2 };
	double tubeDiam[] = { B / 2 - 50, B / 2 - 50, 500 };
	int n = 10;

	makeRectToTubeTransition(cpRectToT_1, vz, vx, heightW, cpRectToT_1, tubeDiam, n);
	makeGrillType1(cpRectToT_1, vx, vz, 20, B / 2 - 50, B / 2 - 50, 30, n, 12);

	makeRectToTubeTransition(cpRectToT_2, vz, vx, heightW, cpRectToT_2, tubeDiam, n);
	makeGrillType1(cpRectToT_2, vx, vz, 20, B / 2 - 50, B / 2 - 50, 30, n, 12);

	makeRectToTubeTransition(cpRectToT_3, vz, vx, heightW, cpRectToT_3, tubeDiam, n);
	makeGrillType1(cpRectToT_3, vx, vz, 20, B / 2 - 50, B / 2 - 50, 30, n, 12);

	makeRectToTubeTransition(cpRectToT_4, vz, vx, heightW, cpRectToT_4, tubeDiam, n);
	makeGrillType1(cpRectToT_4, vx, vz, 20, B / 2 - 50, B / 2 - 50, 30, n, 12);

	FdPoint3d box_1(B / 2 + A / 16, B / 4, H * 0.9 - 500), box_2(B / 2 + A / 16, B / 4 + 200, H * 0.9 - 500);
	FdPoint3d box_3(B / 2 + A / 16, - B / 4, H * 0.9 - 500), box_4(B / 2 + A / 16, - B / 4 - 200, H * 0.9 - 500);
	FdPoint3d CP_box_1[] = { box_1, box_2 };
	FdPoint3d CP_box_2[] = { box_3, box_4 };

	double Height_box[] = { - A / 8, - A / 8 };
	bool sides_box[] = { true, true, true, true };

	makeBox(1, CP_box_1, Height_box, Height_box, sides_box, conn_s, true, true);
	makeBox(1, CP_box_2, Height_box, Height_box, sides_box, conn_s, true, true);
	
	double diam1 = A / 12;

	FdPoint3d tube_1(B / 2 + diam1, - B / 4 - 100, H * 0.9 - 500 - A / 16), tube_2(B / 2 + diam1, - B / 4 - 100, H * 0.9 - 700 - A / 16);
	FdPoint3d tube_3(B / 2 + diam1, B / 4 + 100, H * 0.9 - 500 - A / 16), tube_4(B / 2 + diam1, B / 4 + 100, H * 0.9 - 700 - A / 16);
	FdPoint3d cp_tube_1[] = { tube_1, tube_2 };	
	FdPoint3d cp_tube_2[] = { tube_3, tube_4 };
	

	makeSimpleTube(cp_tube_1, diam1, diam1, n);
	makeSimpleTube(cp_tube_2, diam1, diam1, n);


	FdPoint3d tube_1_IN(B / 2, - B / 4 - 100, H * 0.6 - 500 + DN / 4), tube_2_IN(B / 2 + 55, - B / 4 - 100, H * 0.6 - 500 + DN / 4);
	FdPoint3d tube_3_IN(B / 2, B / 4 + 100, H * 0.6 - 500 + DN / 4), tube_4_IN(B / 2 + 55, B / 4 + 100, H * 0.6 - 500 + DN / 4);

	FdPoint3d tube_1_OUT(B / 2, - B / 4 - 100, H * 0.5 - 500 - DN / 4), tube_2_OUT(B / 2 + 55, - B / 4 - 100, H * 0.5 - 500 - DN / 4);
	FdPoint3d tube_3_OUT(B / 2, B / 4 + 100, H * 0.5 - 500 - DN / 4), tube_4_OUT(B / 2 + 55, B / 4 + 100, H * 0.5 - 500 - DN / 4);

	FdPoint3d cp_tube_IN_1[] = { tube_1_IN, tube_2_IN };	
	FdPoint3d cp_tube_IN_2[] = { tube_3_IN, tube_4_IN };
	FdPoint3d cp_tube_OUT_1[] = { tube_1_OUT, tube_2_OUT };	
	FdPoint3d cp_tube_OUT_2[] = { tube_3_OUT, tube_4_OUT };

	makeSimpleTube(cp_tube_IN_1, DN, DN, n);
	makeSimpleTube(cp_tube_IN_2, DN, DN, n);
	makeSimpleTube(cp_tube_OUT_1, DN, DN, n);
	makeSimpleTube(cp_tube_OUT_2, DN, DN, n);

	return 0;
}

short CGeneralBlockCreator::makeJC()
{
	ads_real A, A1, B, H, DN;

	get_val("A", A); get_val("A1", A1); get_val("B", B); get_val("H", H); get_val("DN", DN);
	double H1 = 300;

	FdPoint3d cp1Box(0, 0, 0), cp2Box(0, 0, H1);
	FdPoint3d cp3Box(B, 0, 0), cp4Box(B, 0, H1);

	FdPoint3d CP_BOX_LEFT[] = { cp1Box, cp2Box };
	FdPoint3d CP_BOX_RIGHT[] = { cp3Box, cp4Box };

	double Width[] = { A, A };
	double Height[] = { B / 10, B / 10 };
	double Height_1[] = { - B / 10, - B / 10 };
	bool sides[] = { true, false, false, false };
	bool sides_1[] = { false, false, true, false };
	bool conn[] = { false, false };

	makeBox(1, CP_BOX_LEFT, Width, Height, sides, conn, true, true);
	makeBox(1, CP_BOX_RIGHT, Width, Height_1, sides, conn, true, true);

	FdPoint3d cp5Box(0, - A / 2 + 400, H1 / 2 + 50), cp6Box(B, - A / 2 + 400, H1 / 2 + 50);
	FdPoint3d CP_BOX_MIDDLE[] = { cp5Box, cp6Box };
	double Height_MIDDLE[] = { B / 10, B / 10 };
	double Width_MIDDLE[] = { H1 - 100, H1 - 100 };

	makeBox(1, CP_BOX_MIDDLE, Width_MIDDLE, Height_MIDDLE, sides_1, conn, true, true);

	FdPoint3d cp7Box(B / 2, ( A - A1 ) / 2, H1), cp8Box(B / 2, ( A - A1 ) / 2, H - H1);
	FdPoint3d CP_BOX_big[] = { cp7Box, cp8Box };

	double Width_big[] = { A1, A1 };
	double Height_big[] = { B, B };
	bool sides_big[] = { true, true, true, true };

	makeBox(1, CP_BOX_big, Width_big, Height_big, sides_big, conn, true, true);

	//left
	FdPoint3d cp7Box_LEFT_WALL_DOWN(0, ( A - A1 ) / 2, H1), cp8Box_LEFT_WALL_DOWN(0, ( A - A1 ) / 2, H / 2);
	FdPoint3d cp9Box_LEFT_WALL_UP(0, ( A - A1 ) / 2, H / 2), cp10Box_LEFT_WALL_UP(0, ( A - A1 ) / 2, H - H1);
	FdPoint3d CP_BOX_LEFT_WALL_DOWN[] = { cp7Box_LEFT_WALL_DOWN, cp8Box_LEFT_WALL_DOWN };
	FdPoint3d CP_BOX_LEFT_WALL_UP[] = { cp9Box_LEFT_WALL_UP, cp10Box_LEFT_WALL_UP };

	double Height_LEFT_WALL[] = { 50, 50 };
	bool sides_LEFT[] = { false, true, false, true };

	makeBox(1, CP_BOX_LEFT_WALL_DOWN, Width_big, Height_LEFT_WALL, sides_LEFT, conn, true, true);
	makeBox(1, CP_BOX_LEFT_WALL_UP, Width_big, Height_LEFT_WALL, sides_LEFT, conn, true, true);

	//right
	FdPoint3d cp11Box_RIGHT_WALL_DOWN(B + B / 10, ( A - A1 ) / 2, H1), cp12Box_RIGHT_WALL_DOWN(B + B / 10, ( A - A1 ) / 2, H / 2);
	FdPoint3d cp13Box_RIGHT_WALL_UP(B + B / 10, ( A - A1 ) / 2, H / 2), cp14Box_RIGHT_WALL_UP(B + B / 10, ( A - A1 ) / 2, H - H1);
	FdPoint3d CP_BOX_RIGHT_WALL_DOWN[] = { cp11Box_RIGHT_WALL_DOWN, cp12Box_RIGHT_WALL_DOWN };
	FdPoint3d CP_BOX_RIGHT_WALL_UP[] = { cp13Box_RIGHT_WALL_UP, cp14Box_RIGHT_WALL_UP };

	bool sides_RIGHT[] = { false, true, false, true };

	makeBox(1, CP_BOX_RIGHT_WALL_DOWN, Width_big, Height_LEFT_WALL, sides_LEFT, conn, true, true);
	makeBox(1, CP_BOX_RIGHT_WALL_UP, Width_big, Height_LEFT_WALL, sides_LEFT, conn, true, true);


	return 0;
}

short CGeneralBlockCreator::makeTERMOPJ()
{
	short type;
	get_val("A", type);	// 1 - dry coolers TermoKey Power-J
						// 2 - dry coolers TermoKey Power-Line Vertical
						// 3 - dry coolers TermoKey Power-Line Horizontal
						// 4 - Trane  CGAM air-cooled scroll chiller
						// 5 - pumps wilo Stratos GIGA
						// 6 - pumps wilo Star
						// 7 - pumps wilo SiBooster
						// 8 - pumps wilo Rexa CUT

		ads_real b;			//from docs - length of internal sections (axis X)
		ads_real c;			//from docs - length of external sections (axis X)
		ads_real e;			//width of top base part  (axis Y)
		ads_real e1;		//width of pillar feet (axis Y)
		ads_real e2;		//width of bottom base part (axis Y)
		ads_real h1;		//height of fans (axis Z)
		ads_real h2;		//height of top pillar part  (axis Z)
		ads_real h3;		//height of bottom pillar part  (axis Z)
		ads_real fanRows;
		ads_real fanInRow;

		get_val("b", b), get_val("c", c), get_val("e", e), get_val("e1", e1), get_val("e2", e2), 
		get_val("h1", h1), get_val("h2", h2), get_val("h3", h3), get_val("fanRows", fanRows),  get_val("fanInRow", fanInRow);

	if( type == 700 )
		type = 7;	//by default

if( type == 1 )		//dry coolers TermoKey Power-J
{
// parameters of different models of dry coolers Power-J from Termokey
	
	/*struct ParametersTermoKeyPowerJ
	{
		ads_real b;			//from docs - length of internal sections (axis X)
		ads_real c;			//from docs - length of external sections (axis X)
		ads_real e;			//width of top base part  (axis Y)
		ads_real e1;		//width of pillar feet (axis Y)
		ads_real e2;		//width of bottom base part (axis Y)
		ads_real h1;		//height of fans (axis Z)
		ads_real h2;		//height of top pillar part  (axis Z)
		ads_real h3;		//height of bottom pillar part  (axis Z)
		ads_real fanRows;
		ads_real fanInRow;
	};
	const int nEquipment = 21;
	ParametersTermoKeyPowerJ params[nEquipment] =
	{
		//b		c		e		e1		e2		h1		h2		h3	fanRows	fanInRow
		{0,		1430,	1181,	1170,	364,	270,	150,	1284,	1,	2 }, //JW_1290._
		{1400,	1430,	1181,	1170,	364,	270,	150,	1284,	1,	3 }, //JW_1390._
		{1400,	1430,	1181,	1170,	364,	270,	150,	1284,	1,	4 }, //JW_1490._
		{1400,	1430,	1181,	1170,	364,	270,	150,	1284,	1,	5 }, //JG_1590._
		{1400,	1430,	1181,	1170,	364,	270,	150,	1284,	1,	6 }, //JG_1690._
		{1400,	1430,	1181,	1170,	364,	270,	150,	1284,	1,	7 }, //JG_1790._
		{0,		1990,	1181,	1170,	364,	270,	150,	1284,	1,	2 }, //JW_1290._Z
		{1960,	1990,	1181,	1170,	364,	270,	150,	1284,	1,	3 }, //JW_1390._Z
		{1960,	1990,	1181,	1170,	364,	270,	150,	1284,	1,	4 }, //JW_1490._Z
		{1960,	1990,	1181,	1170,	364,	270,	150,	1284,	1,	5 }, //JG_1590._Z

		{0,		1280,	2410,	2310,	670,	268,	100,	1794,	2,	2 }, //JW_2290._
		{1250,	1280,	2410,	2310,	670,	268,	100,	1794,	2,	3 }, //JW_2390._
		{1250,	1280,	2410,	2310,	670,	268,	100,	1794,	2,	4 }, //JW_2490._
		{1250,	1280,	2410,	2310,	670,	268,	100,	1794,	2,	5 }, //JG_2590._
		{1250,	1280,	2410,	2310,	670,	268,	100,	1794,	2,	6 }, //JG_2690._
		{1250,	1280,	2410,	2310,	670,	268,	100,	1794,	2,	7 }, //JG_2790._
		{1250,	1280,	2410,	2310,	670,	268,	100,	1794,	2,	8 }, //JG_2890._
		{0,		2030,	2410,	2310,	670,	268,	100,	1794,	2,	2 }, //JW_2290._Z
		{2000,	2030,	2410,	2310,	670,	268,	100,	1794,	2,	3 }, //JW_2390._Z
		{2000,	2030,	2410,	2310,	670,	268,	100,	1794,	2,	4 }, //JW_2490._Z
		{2000,	2030,	2410,	2310,	670,	268,	100,	1794,	2,	5 }  //JG_2590._Z
	};

//debug drawing ----------------------------------
	short model;
	get_val("B", model);
	int nextEquipment = model;
	if( nextEquipment >= nEquipment )
		nextEquipment = nEquipment-1;

	if( nextEquipment < 0 )
		nextEquipment = 0;
//debug drawing ----------------------------------

	ParametersTermoKeyPowerJ& param = params[nextEquipment];
	ASSERT(param.fanInRow >= 2);
	*/

	const ads_real fanDiam = 900;
	const ads_real a1 = 150;			//pillar feet size by X
	const ads_real h4 = 100;			//pillar feet size by Z
	ads_real a = c * 2 + b * (fanInRow - 2);	//total length (axis X)
	ads_real h = h1 + h2 + h3 + h4;			//total height (axis Z)
	
//creation base form
	FdPoint3d	p1(0, 0, h/2 - h1); 
	FdPoint3d	p2(0, 0, p1.z - h2);
	FdPoint3d	p3(0, 0, -(h/2 - h4));
	FdVector3d	normal(0, 0, -1);
	FdVector3d	upVect(0, 1, 0);

	const int count1 = 3;
	FdPoint3d p[count1] = { p1, p2, p3 };
	FdVector3d normals[count1] = { normal, normal, normal };
	FdVector3d upVectors[count1] = { upVect, upVect, upVect };
	double tabWidth[count1] = { a, a, a };
	double tabHeight[count1] = { e, e, e2};
	
	int nSides = count1*4;
	bool* sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		sides[i] = true;

	int nEdges = count1*2 + 1;
	bool (*edges)[4] = new bool[nEdges][4];
	for(int i=0; i < nEdges; i++)
		for(int j=0; j < 4; j++)
			edges[i][j] = true;

#ifndef FIX_BRX
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
#else
	bool* _sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		_sides[i] = false;
		
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);
#endif

//creation sections
	FdPoint3d centerPillar(-a/2, 0, -(h/2 - h4));
	FdPoint3d centerFan(-a/2, 0, h/2);
	const int fanSegments = 2;
	double diamsFan[fanSegments+1][2] = {0.1, 0.1, fanDiam, fanDiam, fanDiam, fanDiam};
	
	tabWidth[0] = a1;
	tabWidth[1] = a1;

	tabHeight[0] = e1;
	tabHeight[1] = e1;

	for( int k=0; k <= fanInRow; k++ )
	{
		ads_real sectionLen = b;
		if( k == 0 || (k == fanInRow-1) )
			sectionLen = c;

		if( k != fanInRow )
		{
		//create fans
			p1 = centerFan;
			p1.x += sectionLen / 2.0;
			p2 = p1;
			p2.z -= h1;

			for(int i=0; i < fanRows; i++)
			{
				if( fanRows == 2 )
				{
					p1.y += (i == 0 ? -e / 4 : e / 2);
					p2.y = p1.y;
				}

				FdPoint3d centers[fanSegments+1] = {p1, p1, p2};
				makeTube(centers, normals, upVectors, diamsFan, 16, fanSegments, false, true);
			}

			centerFan.x += sectionLen;
		}

	//create pillar
		FdPoint3d pillar[4];
		p1 = centerPillar;
		if( k == 0 )
		{
			p1.x += 10;
		}
		else if( k == fanInRow )
		{
			p1.x -= 10;
		}	

		ads_real pillarWidth = e1 * 3.0 / 4.0;
		p1.y -= pillarWidth/2.0;
		pillar[0] = p1;

		p1.z += h3;
		pillar[1] = p1;

		p1.y += pillarWidth;
		pillar[2] = p1;
	
		p1.z -= h3;
		pillar[3] = p1;

		makePlane(pillar, true);

	//pillar feet
		int count2 = 2;
		p[0] = centerPillar;
		p[1] = p[0];
		p[1].z -= h4;

		centerPillar.x += sectionLen;
		
#ifndef FIX_BRX
		makeBox(count2-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
#else
		makeBox(count2-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
		makeBox(count2-1, p, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);
#endif
	}

	delete [] sides;
	delete [] edges;

#ifndef FIX_BRX
	delete [] _sides;
#endif

	return 0;
}
else if( type == 2 ){

		ads_real b;			//B from docs - length of internal sections (axis X)
		ads_real c;			//C from docs - thickness of main box with fan (axis Y)
		ads_real d;			//width of main box (axis Y)
		ads_real d1;		//width of feet (axis Y)
		ads_real e;			//E from docs - height of main box (axis Z)
		ads_real e1;		//height of feet under main box (axis Z)
		ads_real f;			//F from docs - length of external sections (axis X)
		ads_real f1;		//width of feet (axis X)
		ads_real k;			//width of box with tubes (axis X)

		ads_real fanRows;
		ads_real fanInRow;
		ads_real fanDiam;	//dry coolers TermoKey Power-Line Vertical
		
		//ads_real feetOrder;
		//ads_real sectionSize;

		get_val("b",b), get_val("c",c), get_val("d",d), get_val("d1",d1), get_val("e",e), 
		get_val("e1",e1), get_val("f",f), get_val("f1",f1), get_val("k",k), get_val("fanRows",fanRows), get_val("fanInRow",fanInRow), get_val("fanDiam",fanDiam);

		long feetOrder;	//Bit array for order of feets. 0 - exist, 1 - non exist. 
								//Number of meaningful bits == fanInRow+1.
								//Order of bits - from end.

		long sectionSize;	//Bit array for length of sections. 0 - B size, 1 - F size. 
									//Number of meaningful bits == fanInRow.
									//Order of bits - from end.

		get_val("feetOrder",feetOrder), get_val("sectionSize",sectionSize);

// parameters of different models of dry coolers Power-Line from Termokey
	/*struct ParametersTermoKeyPowerLineV
	{
		ads_real b;			//B from docs - length of internal sections (axis X)
		ads_real c;			//C from docs - thickness of main box with fan (axis Y)
		ads_real d;			//width of main box (axis Y)
		ads_real d1;		//width of feet (axis Y)
		ads_real e;			//E from docs - height of main box (axis Z)
		ads_real e1;		//height of feet under main box (axis Z)
		ads_real f;			//F from docs - length of external sections (axis X)
		ads_real f1;		//width of feet (axis X)
		ads_real k;			//width of box with tubes (axis X)

		ads_real fanRows;
		ads_real fanInRow;
		ads_real fanDiam;
		
		unsigned int feetOrder;	//Bit array for order of feets. 0 - exist, 1 - non exist. 
								//Number of meaningful bits == fanInRow+1.
								//Order of bits - from end.

		unsigned int sectionSize;	//Bit array for length of sections. 0 - B size, 1 - F size. 
									//Number of meaningful bits == fanInRow.
									//Order of bits - from end.
	};
	const int nEquipment = 39;
	ParametersTermoKeyPowerLineV params[nEquipment] =
	{	//													 fanInRow feetOrder
		//b		c	 d	  d1   e	 e1	 f	   f1	k    fanRows fanDiam	sectionSize
		{0,		480, 350, 600, 820,	 50, 830,  100,	250, 1,	 1,	 500, 0x3,  0x1}, //_1150._		[0]
		{0,		480, 350, 600, 820,	 50, 805,  100,	250, 1,	 2,	 500, 0x5,  0x3}, //_1250._
		{0,		480, 350, 600, 1180, 50, 1190, 100,	250, 1,	 1,	 630, 0x3,  0x1}, //_1163._
		{0,		480, 350, 600, 1180, 50, 1165, 100,	250, 1,	 2,	 630, 0x5,  0x3}, //_1263._
		{1140,	480, 350, 600, 1180, 50, 1165, 100,	250, 1,	 3,	 630, 0xF,  0x5}, //_1363._
		{1140,	480, 350, 600, 1180, 50, 1165, 100,	250, 1,	 4,	 630, 0x3F, 0x9}, //_1463._
					 	 	  		 	 		 	 	 
		{0,		765, 500, 800, 1320, 50, 1410, 120,	410, 1,	 1,	 800, 0x3,  0x1},  //_1180._	[6]
		{0,		765, 500, 800, 1320, 50, 1380, 120,	410, 1,	 2,	 800, 0x5,  0x3},  //_1280._
		{0,		765, 500, 800, 1320, 50, 1370, 120,	410, 1,	 3,	 800, 0x9,  0x7},  //_1380._
		{0,		765, 500, 800, 1320, 50, 1365, 120,	410, 1,	 4,	 800, 0x15, 0xF},  //_1480._
		{1350,	765, 500, 800, 1320, 50, 1365, 120,	410, 1,	 5,	 800, 0x2D, 0x1B}, //_1580._
		{1350,	765, 500, 800, 1320, 50, 1365, 120,	410, 1,	 6,	 800, 0x55, 0x33}, //_1680._
		{1350,	765, 500, 800, 1320, 50, 1360, 120,	410, 1,	 7,	 800, 0x99, 0x77}, //_1780._
		
		//													 fanInRow feetOrder
		//b		c	 d	  d1   e	 e1	 f	   f1	k    fanRows fanDiam	sectionSize
		{0,		765, 500, 800, 2340, 50, 1410, 120,	410, 2,	 1,	 800, 0x3, 0x1}, //_2180._		[13]
		{0,		765, 500, 800, 2340, 50, 1560, 120,	410, 2,	 1,	 900, 0x3, 0x1}, //_2190._N
		{0,		765, 500, 800, 2340, 50, 1810, 120,	410, 2,	 1,	 900, 0x3, 0x1}, //_2190._X 
		{0,		765, 500, 800, 2340, 50, 2160, 120,	410, 2,	 1,	 900, 0x3, 0x1}, //_2190._Z
		{0,		765, 500, 800, 2340, 50, 1380, 120,	410, 2,	 2,	 800, 0x5, 0x3}, //_2280._ 
		{0,		765, 500, 800, 2340, 50, 1530, 120,	410, 2,	 2,	 900, 0x5, 0x3}, //_2290._N
		{0,		765, 500, 800, 2340, 50, 1780, 120,	410, 2,	 2,	 900, 0x5, 0x3}, //_2290._X
		{0,		765, 500, 800, 2340, 50, 2130, 120,	410, 2,	 2,	 900, 0x5, 0x3}, //_2290._Z
		{0,		765, 500, 800, 2340, 50, 1370, 120,	410, 2,	 3,	 800, 0x9, 0x7}, //_2380._		[21]
		{0,		765, 500, 800, 2340, 50, 1520, 120,	410, 2,	 3,	 900, 0x9, 0x7}, //_2390._N
		{0,		765, 500, 800, 2340, 50, 1770, 120,	410, 2,	 3,	 900, 0x9, 0x7}, //_2390._X
		{0,		765, 500, 800, 2340, 50, 2120, 120,	410, 2,	 3,	 900, 0x9, 0x7}, //_2390._Z
		{0,		765, 500, 800, 2340, 50, 1365, 120,	410, 2,	 4,	 800, 0x15, 0xF}, //_2480._
		{0,		765, 500, 800, 2340, 50, 1515, 120,	410, 2,	 4,	 900, 0x15, 0xF}, //_2490._N
		{0,		765, 500, 800, 2340, 50, 1765, 120,	410, 2,	 4,	 900, 0x15, 0xF}, //_2490._X
		{0,		765, 500, 800, 2340, 50, 2115, 120,	410, 2,	 4,	 900, 0x15, 0xF}, //_2490._Z
		{1350,	765, 500, 800, 2340, 50, 1365, 120,	410, 2,	 5,	 800, 0x2D, 0x1B}, //_2580._
		{1500,	765, 500, 800, 2340, 50, 1515, 120,	410, 2,	 5,	 900, 0x2D, 0x1B}, //_2590._N	[30]
		{1750,	765, 500, 800, 2340, 50, 1765, 120,	410, 2,	 5,	 900, 0x2D, 0x1B}, //_2590._X
		//mistake in docs for _2590._Z  B is 0 but should be 2100
		{2100,	765, 500, 800, 2340, 50, 2115, 120,	410, 2,	 5,	 900, 0x2D, 0x1B}, //_2590._Z
		{1350,	765, 500, 800, 2340, 50, 1365, 120,	410, 2,	 6,	 800, 0x55, 0x33}, //_2680._
		{1500,	765, 500, 800, 2340, 50, 1515, 120,	410, 2,	 6,	 900, 0x55, 0x33}, //_2690._N 
		{1750,	765, 500, 800, 2340, 50, 1765, 120,	410, 2,	 6,	 900, 0x55, 0x33}, //_2690._X
		{1350,	765, 500, 800, 2340, 50, 1360, 120,	410, 2,	 7,	 800, 0x99, 0x77}, //_2780._
		{1500,	765, 500, 800, 2340, 50, 1510, 120,	410, 2,	 7,	 900, 0x99, 0x77}, //_2790._N
		{1350,	765, 500, 800, 2340, 50, 1360, 120,	410, 2,	 8,	 800, 0x129, 0xE7} //_2880._	[38]
	};
	
//debug drawing ----------------------------------
	short model;
	get_val("B", model);
	int nextEquipment = model;
	if( nextEquipment >= nEquipment )
		nextEquipment = nEquipment-1;

	if( nextEquipment < 0 )
		nextEquipment = 0;
//debug drawing ----------------------------------

	ParametersTermoKeyPowerLineV& param = params[nextEquipment];
	
	ads_real a = 0;						//total length (axis X)
	ads_real h = param.e + param.e1;	//total height (axis Z)
	*/
	
	ads_real a = 0;						//total length (axis X)
	//get_val("a", a);

	unsigned int bitStop = 1 << int(fanInRow);
	for(unsigned int bitMask = 1; bitMask != bitStop; bitMask *= 2 )
	{
		if( (sectionSize & bitMask) == 0 )	//debug
		{
			ASSERT(b != 0);	//B should be > 0 if used in this model of equipment
		}

		a += (sectionSize&bitMask) ? f : b;
	}
	
	ads_real h = e + e1;				//total height (axis Z)
	get_val("h", h);
//creation base form
	FdPoint3d	p1(0, 0, h/2); 
	FdPoint3d	p2(0, 0, -h/2 + e1);
	FdVector3d	normal(0, 0, -1);
	FdVector3d	upVect(0, 1, 0);

	const int count1 = 2;
	FdPoint3d p[count1] = { p1, p2 };
	FdVector3d normals[count1] = { normal, normal };
	FdVector3d upVectors[count1] = { upVect, upVect };
	double tabWidth[count1] = { a, a };
	double tabHeight[count1] = { d, d };
	
	int nSides = count1*4;
	bool* sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		sides[i] = true;

	int nEdges = count1*2 + 1;
	bool (*edges)[4] = new bool[nEdges][4];
	for(int i=0; i < nEdges; i++)
		for(int j=0; j < 4; j++)
			edges[i][j] = true;

#ifndef FIX_BRX
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
#else
	bool* _sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		_sides[i] = false;
		
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);
#endif

//creation sections
	FdPoint3d centerPillar( -a/2, 0, -h/2 + e1 );
	FdPoint3d centerFan( -a/2, d/2, e1/2 );
	const int fanSegments = 2;
	double diamsFan[fanSegments+1][2] = {fanDiam, fanDiam, fanDiam, fanDiam, 0.1, 0.1};
	
	FdVector3d	normalFan(0, -1, 0);
	FdVector3d	upVectFan(0, 0, 1);

	FdVector3d normalsFan[fanSegments+1] = { normalFan, normalFan, normalFan };
	FdVector3d upVectorsFan[fanSegments+1] = { upVectFan, upVectFan, upVectFan };

	tabWidth[0] = f1;
	tabWidth[1] = f1;

	tabHeight[0] = d1;
	tabHeight[1] = d1;

	for( int k=0; k <= fanInRow; k++ )
	{
		unsigned int bitMask = 1 << k;

		ads_real sectionLen = b;
		if( k != fanInRow && (sectionSize & bitMask) )
			sectionLen = f;

		if( k != fanInRow )
		{
		//create fans
			p1 = centerFan;
			p1.x += sectionLen / 2.0;
			p2 = p1;
			p2.y += c - d;

			for(int i=0; i < fanRows; i++)
			{
				if( fanRows == 2 )
				{
					p1.z += (i == 0 ? -e / 4 : e / 2);
					p2.z = p1.z;
				}

				FdPoint3d centers[fanSegments+1] = {p1, p2, p2};
				makeTube(centers, normalsFan, upVectorsFan, diamsFan, 16, fanSegments, false, true);
			}

			centerFan.x += sectionLen;
		}

	//create feet
		if( feetOrder & bitMask )
		{
			p[0] = centerPillar;
			p[1] = p[0];
			p[1].z -= e1;

#ifndef FIX_BRX
			makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
#else
			makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
			makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);
#endif
		}
		centerPillar.x += sectionLen;
		
	}

	delete [] sides;
	delete [] edges;

#ifndef FIX_BRX
	delete [] _sides;
#endif

	return 0;
}
else if( type == 3 ) //dry coolers TermoKey Power-Line Horizontal
{

		ads_real b;			//B from docs - length of internal sections (axis X)
		ads_real c;			//C from docs - thickness of main box with fan (axis Z)
		ads_real d;			//D from docs - width of main box (axis Y)
		ads_real d1;		//width of feet (axis Y)
		ads_real f;			//F from docs - length of external sections (axis X)
		ads_real f1;		//width of feet (axis X)
		ads_real h1;		//height of feet over main box (axis Z)
		ads_real h2;		//height of main box (axis Z)
		ads_real h3;		//height of feet under main box (axis Z)
		ads_real k;			//width of box with tubes (axis Y)

		ads_real fanRows;
		ads_real fanInRow;
		ads_real fanDiam;
		
		get_val("b",b), get_val("c",c), get_val("d",d), get_val("d1",d1), get_val("f",f), get_val("f1",f1), get_val("h1",h1), get_val("h2",h2), get_val("h3",h3), 
		get_val("k",k), get_val("fanRows",fanRows), get_val("fanInRow",fanInRow), get_val("fanDiam",fanDiam);
		
		long feetOrder;	//Bit array for order of feets. 0 - exist, 1 - non exist. 
								//Number of meaningful bits == fanInRow+1.
								//Order of bits - from end.

		long sectionSize;	//Bit array for length of sections. 0 - B size, 1 - F size. 
									//Number of meaningful bits == fanInRow.
									//Order of bits - from end.

		get_val("feetOrder",feetOrder), get_val("sectionSize",sectionSize);

// parameters of different models of dry coolers Power-Line from Termokey
	/*struct ParametersTermoKeyPowerLineH
	{
		ads_real b;			//B from docs - length of internal sections (axis X)
		ads_real c;			//C from docs - thickness of main box with fan (axis Z)
		ads_real d;			//D from docs - width of main box (axis Y)
		ads_real d1;		//width of feet (axis Y)
		ads_real f;			//F from docs - length of external sections (axis X)
		ads_real f1;		//width of feet (axis X)
		ads_real h1;		//height of feet over main box (axis Z)
		ads_real h2;		//height of main box (axis Z)
		ads_real h3;		//height of feet under main box (axis Z)
		ads_real k;			//width of box with tubes (axis Y)

		ads_real fanRows;
		ads_real fanInRow;
		ads_real fanDiam;

		unsigned int feetOrder;	//Bit array for order of feets. 0 - exist, 1 - non exist. 
								//Number of meaningful bits == fanInRow+1.
								//Order of bits - from end.

		unsigned int sectionSize;	//Bit array for length of sections. 0 - B size, 1 - F size. 
									//Number of meaningful bits == fanInRow.
									//Order of bits - from end.
	};
	const int nEquipment = 39;
	ParametersTermoKeyPowerLineH params[nEquipment] =
	{	//													     fanInRow feetOrder
		//b		c	 d	   d1  f	 f1	  h1  h2   h3   k    fanRows fanDiam	sectionSize
		{0,		480, 900,  40, 830,  70,  40, 350, 500, 250, 1,	 1,	 500, 0x3,  0x1}, //_1150._		[0]
		{0,		480, 900,  40, 805,  70,  40, 350, 500, 250, 1,	 2,	 500, 0x5,  0x3}, //_1250._
		{0,		480, 1260, 40, 1190, 70,  40, 350, 500, 250, 1,	 1,	 630, 0x3,  0x1}, //_1163._
		{0,		480, 1260, 40, 1165, 70,  40, 350, 500, 250, 1,	 2,	 630, 0x5,  0x3}, //_1263._
		{1140,	480, 1260, 40, 1165, 70,  40, 350, 500, 250, 1,	 3,	 630, 0xF,  0x5}, //_1363._
		{1140,	480, 1260, 40, 1165, 70,  40, 350, 500, 250, 1,	 4,	 630, 0x3F, 0x9}, //_1463._
		
		{0,		765, 1380, 30, 1410, 120, 50, 500, 800, 410, 1,	 1,	 800, 0x3,  0x1},  //_1180._	[6]
		{0,		765, 1380, 30, 1380, 120, 50, 500, 800, 410, 1,	 2,	 800, 0x5,  0x3},  //_1280._
		{0,		765, 1380, 30, 1370, 120, 50, 500, 800, 410, 1,	 3,	 800, 0x9,  0x7},  //_1380._
		{0,		765, 1380, 30, 1365, 120, 50, 500, 800, 410, 1,	 4,	 800, 0x15, 0xF},  //_1480._
		{1350,	765, 1380, 30, 1365, 120, 50, 500, 800, 410, 1,	 5,	 800, 0x2D, 0x1B}, //_1580._
		{1350,	765, 1380, 30, 1365, 120, 50, 500, 800, 410, 1,	 6,	 800, 0x55, 0x33}, //_1680._
		{1350,	765, 1380, 30, 1360, 120, 50, 500, 800, 410, 1,	 7,	 800, 0x99, 0x77}, //_1780._
		
		//													     fanInRow feetOrder
		//b		c	 d	   d1  f	 f1	  h1  h2   h3   k    fanRows fanDiam	sectionSize
		{0,		765, 2400, 30, 1410, 120, 50, 500, 800, 410, 2,	 1,	 800, 0x3, 0x1}, //_2180._		[13]
		{0,		765, 2400, 30, 1560, 120, 50, 500, 800, 410, 2,	 1,	 900, 0x3, 0x1}, //_2190._N
		{0,		765, 2400, 30, 1810, 120, 50, 500, 800, 410, 2,	 1,	 900, 0x3, 0x1}, //_2190._X 
		{0,		765, 2400, 30, 2160, 120, 50, 500, 800, 410, 2,	 1,	 900, 0x3, 0x1}, //_2190._Z
		{0,		765, 2400, 30, 1380, 120, 50, 500, 800, 410, 2,	 2,	 800, 0x5, 0x3}, //_2280._ 
		{0,		765, 2400, 30, 1530, 120, 50, 500, 800, 410, 2,	 2,	 900, 0x5, 0x3}, //_2290._N
		{0,		765, 2400, 30, 1780, 120, 50, 500, 800, 410, 2,	 2,	 900, 0x5, 0x3}, //_2290._X
		{0,		765, 2400, 30, 2130, 120, 50, 500, 800, 410, 2,	 2,	 900, 0x5, 0x3}, //_2290._Z
		{0,		765, 2400, 30, 1370, 120, 50, 500, 800, 410, 2,	 3,	 800, 0x9, 0x7}, //_2380._		[21]
		{0,		765, 2400, 30, 1520, 120, 50, 500, 800, 410, 2,	 3,	 900, 0x9, 0x7}, //_2390._N
		{0,		765, 2400, 30, 1770, 120, 50, 500, 800, 410, 2,	 3,	 900, 0x9, 0x7}, //_2390._X
		{0,		765, 2400, 30, 2120, 120, 50, 500, 800, 410, 2,	 3,	 900, 0x9, 0x7}, //_2390._Z
		{0,		765, 2400, 30, 1365, 120, 50, 500, 800, 410, 2,	 4,	 800, 0x15, 0xF}, //_2480._
		{0,		765, 2400, 30, 1515, 120, 50, 500, 800, 410, 2,	 4,	 900, 0x15, 0xF}, //_2490._N
		{0,		765, 2400, 30, 1765, 120, 50, 500, 800, 410, 2,	 4,	 900, 0x15, 0xF}, //_2490._X
		{0,		765, 2400, 30, 2115, 120, 50, 500, 800, 410, 2,	 4,	 900, 0x15, 0xF}, //_2490._Z
		{1350,	765, 2400, 30, 1365, 120, 50, 500, 800, 410, 2,	 5,	 800, 0x2D, 0x1B}, //_2580._
		{1500,	765, 2400, 30, 1515, 120, 50, 500, 800, 410, 2,	 5,	 900, 0x2D, 0x1B}, //_2590._N	[30]
		{1750,	765, 2400, 30, 1765, 120, 50, 500, 800, 410, 2,	 5,	 900, 0x2D, 0x1B}, //_2590._X
		//mistake in docs for _2590._Z  B is 0 but should be 2100
		{2100,	765, 2400, 30, 2115, 120, 50, 500, 800, 410, 2,	 5,	 900, 0x2D, 0x1B}, //_2590._Z
		{1350,	765, 2400, 30, 1365, 120, 50, 500, 800, 410, 2,	 6,	 800, 0x55, 0x33}, //_2680._
		{1500,	765, 2400, 30, 1515, 120, 50, 500, 800, 410, 2,	 6,	 900, 0x55, 0x33}, //_2690._N 
		{1750,	765, 2400, 30, 1765, 120, 50, 500, 800, 410, 2,	 6,	 900, 0x55, 0x33}, //_2690._X
		{1350,	765, 2400, 30, 1360, 120, 50, 500, 800, 410, 2,	 7,	 800, 0x99, 0x77}, //_2780._
		{1500,	765, 2400, 30, 1510, 120, 50, 500, 800, 410, 2,	 7,	 900, 0x99, 0x77}, //_2790._N
		{1350,	765, 2400, 30, 1360, 120, 50, 500, 800, 410, 2,	 8,	 800, 0x129, 0xE7} //_2880._	[38]
	};

//debug drawing ----------------------------------
	short model;
	get_val("B", model);
	int nextEquipment = model;
	if( nextEquipment >= nEquipment )
		nextEquipment = nEquipment-1;

	if( nextEquipment < 0 )
		nextEquipment = 0;
//debug drawing ----------------------------------

	ParametersTermoKeyPowerLineH& param = params[nextEquipment];*/
	
	ads_real a = 0;			//total length (axis X)
	ads_real h = c + h3;	//total height (axis Z)
	ads_real hFan = c - h2;	//height of fan (axis Z)

	get_val("h", h);
	get_val("hFan", hFan);

	unsigned int bitStop = 1 << int(fanInRow);
	for(unsigned int bitMask = 1; bitMask != bitStop; bitMask *= 2 )
	{
		if( (sectionSize & bitMask) == 0 )	//debug
		{
			ASSERT(b != 0);	//B should be > 0 if used in this model of equipment
		}

		a += (sectionSize&bitMask) ? f : b;
	}
	
//creation base form
	FdPoint3d	p1(0, 0, h/2 - hFan); 
	FdPoint3d	p2(0, 0, -h/2 + h3);
	FdVector3d	normal(0, 0, -1);
	FdVector3d	upVect(0, 1, 0);

	const int count1 = 2;
	FdPoint3d p[count1] = { p1, p2 };
	FdVector3d normals[count1] = { normal, normal };
	FdVector3d upVectors[count1] = { upVect, upVect };
	double tabWidth[count1] = { a, a };
	double tabHeight[count1] = { d, d };
	
	int nSides = count1*4;
	bool* sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		sides[i] = true;

	int nEdges = count1*2 + 1;
	bool (*edges)[4] = new bool[nEdges][4];
	for(int i=0; i < nEdges; i++)
		for(int j=0; j < 4; j++)
			edges[i][j] = true;

#ifndef FIX_BRX
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
#else
	bool* _sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		_sides[i] = false;
		
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);
#endif

//create box around in/output pipes
	p1.x -= a/2;
	p2.x = p1.x;
	
	FdPoint3d p3(p2);
	FdPoint3d p4(p1);
	
	p3.x -= k;
	p4.x -= k;

	p3.z += h2/2;
	
	p1.y = d/2.0;
	p2.y = p1.y;
	p3.y = p1.y;
	p4.y = p1.y;
	
	FdPoint3d p1n(p1);
	FdPoint3d p2n(p2);
	FdPoint3d p3n(p3);
	FdPoint3d p4n(p4);

	p1n.y -= d;
	p2n.y = p1n.y;
	p3n.y = p1n.y;
	p4n.y = p1n.y;

	FdPoint3d pipeBox[4];
	
	pipeBox[0] = p1;
	pipeBox[1] = p2;
	pipeBox[2] = p3;
	pipeBox[3] = p4;
	makePlane(pipeBox, true);	//left side
	
	pipeBox[0] = p1n;
	pipeBox[1] = p2n;
	pipeBox[2] = p3n;
	pipeBox[3] = p4n;
	makePlane(pipeBox, true);	//right side
	
	pipeBox[0] = p1;
	pipeBox[1] = p4;
	pipeBox[2] = p4n;
	pipeBox[3] = p1n;
	makePlane(pipeBox, true);	//top side
	
	pipeBox[0] = p3;
	pipeBox[1] = p4;
	pipeBox[2] = p4n;
	pipeBox[3] = p3n;
	makePlane(pipeBox, true);	//front side

//creation sections
	FdPoint3d centerPillar( -a/2, 0, h/2 - hFan + h1 );
	FdPoint3d centerFan( -a/2, 0, h/2 );
	const int fanSegments = 2;
	double diamsFan[fanSegments+1][2] = {0.1, 0.1, fanDiam, fanDiam, fanDiam, fanDiam};
	
	FdVector3d normalsFan[fanSegments+1] = { normal, normal, normal };
	FdVector3d upVectorsFan[fanSegments+1] = { upVect, upVect, upVect };

	tabWidth[0] = f1;
	tabWidth[1] = f1;

	tabHeight[0] = d1;
	tabHeight[1] = d1;

	ads_real feetHeight = h1 + h2 + h3;
	get_val("feetHeight", feetHeight);

	for( int k=0; k <= fanInRow; k++ )
	{
		unsigned int bitMask = 1 << k;

		ads_real sectionLen = b;
		if( k != fanInRow && (sectionSize & bitMask) )
			sectionLen = f;

		if( k != fanInRow )
		{
		//create fans
			p1 = centerFan;
			p1.x += sectionLen / 2.0;
			p2 = p1;
			p2.z -= hFan;

			for(int i=0; i < fanRows; i++)
			{
				if( fanRows == 2 )
				{
					p1.y += (i == 0 ? -d / 4 : d / 2);
					p2.y = p1.y;
				}

				FdPoint3d centers[fanSegments+1] = {p1, p1, p2};
				makeTube(centers, normalsFan, upVectorsFan, diamsFan, 16, fanSegments, false, true);
			}

			centerFan.x += sectionLen;
		}

	//create feet
		if( feetOrder & bitMask )
		{
			for(int i=0; i < 2; i++)
			{
				ads_real sign = (i == 0 ? -1 : 1);

				p[0] = centerPillar;
				p[0].y += sign * (d + d1)/2;

				p[1] = p[0];
				p[1].z -= feetHeight;

#ifndef FIX_BRX
				makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
#else
				makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
				makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);
#endif
			}
		}
		centerPillar.x += sectionLen;
		
	}

	delete [] sides;
	delete [] edges;

#ifndef FIX_BRX
	delete [] _sides;
#endif

	return 0;
}
else if( type == 4 ) //Trane  CGAM air-cooled scroll chiller
{

		ads_real e;			//deep of main box (axis Y)
		ads_real c;			//C from docs - length of main box (axis X)
		
		ads_real dInZ;		//height of chilled water inlet from floor (axis Z)
		ads_real dInY;		//distance of chilled water inlet from corner (axis Y)

		ads_real dOutZ;		//height of chilled water outlet from floor (axis Z)
		ads_real dOutY;		//distance of chilled water outlet from corner (axis Y)

		ads_real dDiam;		//diameter for chilled water inlet/outlet.

		ads_real h;			//height of main box (axis Z)

		ads_real fanRows;
		ads_real fanInRow;
		
			//Next group of dimensions shows different options. 
			//If some option is included in equipment then we need to add value for full size (c, asix X).
	//	ads_real pp;		//NO addition length if Pump Package option included.
		ads_real bt;		//addition length if Buffer Tank  option included (only available with Pump Package).
		ads_real phr;	

		get_val("e", e), get_val("c", c), get_val("dInZ", dInZ), get_val("dInY", dInY), get_val("dOutZ", dOutZ),  get_val("dOutY", dOutY), 
		get_val("dDiam", dDiam), get_val("h", h), get_val("fanRows", fanRows), get_val("fanInRow", fanInRow), get_val("bt", bt), get_val("phr", phr);
/*
// parameters of different models of dry coolers Power-Line from Termokey
	struct ParametersTraneCGAMChiller
	{
		ads_real e;			//deep of main box (axis Y)
		ads_real c;			//C from docs - length of main box (axis X)
		
		ads_real dInZ;		//height of chilled water inlet from floor (axis Z)
		ads_real dInY;		//distance of chilled water inlet from corner (axis Y)

		ads_real dOutZ;		//height of chilled water outlet from floor (axis Z)
		ads_real dOutY;		//distance of chilled water outlet from corner (axis Y)

		ads_real dDiam;		//diameter for chilled water inlet/outlet.

		ads_real h;			//height of main box (axis Z)

		ads_real fanRows;
		ads_real fanInRow;
		
			//Next group of dimensions shows different options. 
			//If some option is included in equipment then we need to add value for full size (c, asix X).
	//	ads_real pp;		//NO addition length if Pump Package option included.
		ads_real bt;		//addition length if Buffer Tank  option included (only available with Pump Package).
		ads_real phr;		//addition length if Partial Heat Recovery option included.
	};
	const int nEquipment = 14;
	ParametersTraneCGAMChiller params[nEquipment] =
	{
	//																			bt		phr
		//e		c		dInZ	dInY	dOutZ	dOutY	dDiam	h	fanRows	fanInRow
		{ 1279,	2890,	515,	429,	246,	429,	50.8,	2151,	1,	2,	514,	0 }, // CGAM020 	[0]
		{ 1279,	2890,	515,	429,	246,	429,	63.5,	2151,	1,	2,	514,	0 }, // CGAM026
		{ 1279,	3804,	515,	429,	246,	429,	63.5,	2151,	1,	3,	516,	0 }, // CGAM030
		{ 1279,	3804,	515,	429,	246,	429,	63.5,	2151,	1,	3,	516,	0 }, // CGAM035
		{ 2245,	2890,	656,	367,	200,	367,	76.2,	2155,	2,	2,	519,	0 }, // CGAM040
		{ 2245,	2890,	656,	367,	200,	367,	76.2,	2155,	2,	2,	519,	0 }, // CGAM052 	[5]
		{ 2245,	3804,	790,	367,	200,	367,	76.2,	2155,	2,	3,	514,	0 }, // CGAM060
		{ 2245,	3804,	790,	367,	200,	367,	76.2,	2155,	2,	3,	514,	0 }, // CGAM070
																			  
		//mistake in docs ??? is quantity of fans for 80 tons 4 (page17) ??? or 6 ??? Looks like 6 is right.		  
		{ 2240,	3634,	790,	292,	200,	292,	101.6,	2349,	2,	3,	0,		56 }, // CGAM080
		{ 2240,	3634,	790,	292,	200,	292,	101.6,	2349,	2,	3,	0,		56 }, // CGAM090

		//mistake in docs ??? c == 3804 (page 41)  and c = 3634 (p.43). What is right ?
		{ 2240,	3804,	790,	292,	200,	292,	101.6,	2349,	2,	4,	0,		56 }, // CGAM100		[10]
		{ 2240,	3804,	790,	292,	200,	292,	101.6,	2349,	2,	4,	0,		56 }, // CGAM110
		{ 2240,	3804,	790,	292,	200,	292,	101.6,	2349,	2,	4,	0,		56 }, // CGAM120
	 
		{ 2240,	5128,	790,	292,	199,	292,	101.6,	2349,	2,	5,	0,		56 }  // CGAM130
	};
	
//debug drawing ----------------------------------
	short model;
	get_val("B", model);
	int nextEquipment = model;
	if( nextEquipment >= nEquipment )
		nextEquipment = nEquipment-1;
		
	if( nextEquipment < 0 )
		nextEquipment = 0;
		*/
	ads_real modelWithBT;	//!0 - option Buffer Tank included, 0 - isn't included
	get_val("H", modelWithBT);

	short modelWithPHR;	//!0 - option Partial Heat Recovery included, 0 - isn't included
	get_val("ftype", modelWithPHR);

//debug drawing ----------------------------------

	//ParametersTraneCGAMChiller& param = params[nextEquipment];
	
	ads_real hFan = 195;			//height of fan over main box (axis Z), approximate value
	ads_real fanDiam1 = 732;				//top part of fan, from docs
	ads_real fanDiam2 = fanDiam1 * 1.19;		//buttom part of fan, approximate value
	ads_real totalLen = c;
	
	if( modelWithBT != 0.0 )
		totalLen += bt;

	if( modelWithPHR != 0.0 )
		totalLen += phr;

//creation base form
	FdPoint3d	p1(0, 0, h/2 - hFan); 
	FdPoint3d	p2(0, 0, -h/2);
	FdVector3d	normal(0, 0, -1);
	FdVector3d	upVect(0, 1, 0);

	const int count1 = 2;
	FdPoint3d p[count1] = { p1, p2 };
	FdVector3d normals[count1] = { normal, normal };
	FdVector3d upVectors[count1] = { upVect, upVect };
	double tabWidth[count1] = { totalLen, totalLen };
	double tabHeight[count1] = { e, e };
	
	int nSides = count1*4;
	bool* sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		sides[i] = true;

	int nEdges = count1*2 + 1;
	bool (*edges)[4] = new bool[nEdges][4];
	for(int i=0; i < nEdges; i++)
		for(int j=0; j < 4; j++)
			edges[i][j] = true;

#ifndef FIX_BRX
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
#else
	bool* _sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		_sides[i] = false;
		
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
	makeBox(count1-1, p, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);

	delete [] _sides;
#endif

	delete [] sides;
	delete [] edges;

//creation fans
	ads_real gapBetweenFansX = 30;		//approximate value
	ads_real gapBetweenFansY = 200;		//approximate value

	ads_real fansBeginGapX = (totalLen - fanDiam2*fanInRow - gapBetweenFansX*(fanInRow-1) ) / 2;
	FdPoint3d centerFan( -totalLen/2 + fansBeginGapX, 0, h/2 );
	const int fanSegments = 2;
	double diamsFan[fanSegments+1][2] = {0.1, 0.1, fanDiam1, fanDiam1, fanDiam2, fanDiam2};
	
	FdVector3d normalsFan[fanSegments+1] = { normal, normal, normal };
	FdVector3d upVectorsFan[fanSegments+1] = { upVect, upVect, upVect };

	for( int k=0; k < fanInRow; k++ )
	{
		p1 = centerFan;
		p1.x += fanDiam2 / 2.0;
		p2 = p1;
		p2.z -= hFan;

		for(int i=0; i < fanRows; i++)
		{
			if( fanRows == 2 )
			{
				ads_real sign = (i == 0 ? -1 : 1);
				p1.y = sign * (fanDiam2 + gapBetweenFansY) / 2;
				p2.y = p1.y;
			}

			FdPoint3d centers[fanSegments+1] = {p1, p1, p2};
			makeTube(centers, normalsFan, upVectorsFan, diamsFan, 16, fanSegments, false, true);
		}

		centerFan.x += fanDiam2 + gapBetweenFansX;
	}

	return 0;
}
else if( type == 5 ) //pumps wilo Stratos GIGA
{

		ads_real dn;
		ads_real dn1;
		ads_real dn2;
		ads_real dn3;
		ads_real dn4;	//diam of engine.
		ads_real L;		//install size.
		ads_real L1;	//pump's center offset from output pipe (can be not equal to half of L).
		ads_real L2;	//distance from pump's center to engin's end.
		ads_real L3;

		get_val("dn", dn), get_val("dn1", dn1), get_val("dn2", dn2), get_val("dn3", dn3), get_val("dn4", dn4), get_val("L", L),
		get_val("L1", L1), get_val("L2", L2), get_val("L3", L3);
/*
// parameters of different models of pumps wilo Stratos GIGA
	struct ParametersWiloPumpStratosGIGA
	{
		ads_real dn;
		ads_real dn1;
		ads_real dn2;
		ads_real dn3;
		ads_real dn4;	//diam of engine.
		ads_real L;		//install size.
		ads_real L1;	//pump's center offset from output pipe (can be not equal to half of L).
		ads_real L2;	//distance from pump's center to engin's end.
		ads_real L3;	//distance from engin's center axis to end of control-box.
	};
	const int nEquipment = 8;
	ParametersWiloPumpStratosGIGA params[nEquipment] =
	{
		//dn	dn1		dn2		dn3		dn4		L		L1		L2		L3
		{ 40,	84,		110,	150,	168,	280,	140,	469,	248 }, // StratosGIGA 40
		{ 50,	99,		125,	165,	168,	280,	140,	461,	248 }, // StratosGIGA 50
		{ 65,	118,	145,	185,	168,	340,	170,	462,	248 }, // StratosGIGA 65
		{ 80,	132,	160,	200,	168,	360,	180,	466,	248 }, // StratosGIGA 80
		{ 100,	156,	180,	220,	175,	450,	225,	555,	256 }, // StratosGIGA 100
		{ 125,	186,	210,	250,	220,	500,	250,	714,	303 }, // StratosGIGA 125
		{ 150,	211,	240,	280,	220,	700,	350,	914,	403 }, // StratosGIGA 150
		{ 200,	266,	295,	335,	220,	800,	400,	958,	403 }  // StratosGIGA 200
	};

//debug drawing ----------------------------------
	short model;
	get_val("B", model);
	int nextEquipment = model;
	if( nextEquipment >= nEquipment )
		nextEquipment = 0;	//nEquipment-1;

	if( nextEquipment < 0 )
		nextEquipment = 0;

//debug drawing ----------------------------------

	ParametersWiloPumpStratosGIGA& param = params[nextEquipment];
	*/

//input/output connectors
	FdVector3d normal(1, 0, 0);
	FdVector3d upVec(0, 0, 1);
	
	const int distPipeInsideSnail	= 10;
	const int distConeOutside		= 2;
	const int distConnThickness		= 17;

	const int connSegments = 7;
	const int maxArray = 15;
	FdPoint3d centers[maxArray] = {
				FdPoint3d(-L1 + distPipeInsideSnail, 0, 0),	//disk	inside snail
				FdPoint3d(-L1 + distPipeInsideSnail, 0, 0),	//pipe	dn
				FdPoint3d(-L1, 0, 0),							//ring	dn - dn1
				FdPoint3d(-L1, 0, 0),							//cone  dn1 - dn3
				FdPoint3d(-L1 + distConeOutside, 0, 0),		//ring  dn1 - dn3
				FdPoint3d(-L1 + distConeOutside, 0, 0),		//pipe	dn3
				FdPoint3d(-L1 + distConeOutside + distConnThickness, 0, 0),	//disk	dn3
				FdPoint3d(-L1 + distConeOutside + distConnThickness, 0, 0)
				};

	FdVector3d normals[maxArray] = { normal, normal, normal, normal, normal, normal, normal, normal };
	FdVector3d upVectors[maxArray] = { upVec, upVec, upVec, upVec, upVec, upVec, upVec, upVec };

	double diams[maxArray][2] = {
				0.1,		0.1,		//disk	inside snail
				dn,	dn,	//pipe	dn
				dn,	dn,	//ring	dn - dn1
				dn1,	dn1,	//cone  dn1 - dn3
				dn1 + distConeOutside, dn1 + distConeOutside,	//ring  dn1 - dn3
				dn3,	dn3,	//pipe	dn3
				dn3,	dn3,	//disk	dn3
				0.1,		0.1
				};
	int tubeComplexQuad = 5;
				
	//left connector
	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, connSegments, false, true);

	for(int i=0; i <= connSegments; i++)
	{
		centers[i].x = L - L1 - (centers[i].x + L1);
	}
	//right connector
	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, connSegments, false, true);
	
//snail part
	FdPoint3d center(0, 0, 0);
	normal.set(0, 0, 1);
	upVec.set(1, 0, 0);

	const int	snailMaterialThickness = 5;
	double snailZ			= dn + snailMaterialThickness*2;
	double dSnailRadius		= L / 4.0 - snailZ / 2.0;	//whole size of snail is 1/2 of L
	double dSnailRadiusMin = snailZ / 2.0 + 0.01;

	if( dSnailRadius < dSnailRadiusMin )
		dSnailRadius = dSnailRadiusMin;

	double sweepAngle = 360;
	int segmentation = 20;
	makeDonutSection(center, normal, upVec, dSnailRadius, snailZ, sweepAngle, tubeComplexQuad, segmentation);

	//output bend
	double donutEndXY = sqrt(dSnailRadius*dSnailRadius/2);
	donutEndXY--;	//to avoid triangulation inaccuracy

	FdPoint3d pt1(-L1 + distConeOutside + distConnThickness, 0, 0);	//DonutOutBend start
	FdPoint3d pt2(-donutEndXY, -donutEndXY, 0);		//DonutOutBend end (inside main donut)
	//FdPoint3d pt3(pt1.x, -1, 0);					//direction to center of DonutOutBend
	
	FdVector3d vec12 = pt2 - pt1;
	FdVector3d vec13(0, -1, 0);
	
	double mod12 = sqrt(vec12.x*vec12.x + vec12.y*vec12.y + vec12.z*vec12.z);
	double mod13 = sqrt(vec13.y*vec13.y);

	double cos213 = (vec12.y * vec13.y)/(mod12 * mod13);

	double dist12half = sqrt(vec12.x*vec12.x + vec12.y*vec12.y + vec12.z*vec12.z) / 2;
	double radiusDonutOutBend = dist12half / cos213;

	center.set(pt1.x, -radiusDonutOutBend, 0);
	normal.set(0, 0, -1);
	upVec.set(0, 1, 0);

	sweepAngle = asin(cos213) * 2;
	sweepAngle = sweepAngle * 180 / ARX_PI;
	segmentation = 5;

	makeDonutSection(center, normal, upVec, radiusDonutOutBend, snailZ, sweepAngle, tubeComplexQuad, segmentation);
	
	//input bend
	pt1.set(L - L1 - distConeOutside - distConnThickness, 0, 0);	//InBend start
	pt2.set(0, 0, -snailZ);														//InBend end 
	FdPoint3d pt3(snailZ/2, 0, -snailZ/4);										//InBend center
	
	vec12 = pt2 - pt1;
	vec13 = pt3 - pt1;
	
	mod12 = sqrt(vec12.x*vec12.x + vec12.y*vec12.y + vec12.z*vec12.z);
	mod13 = sqrt(vec13.x*vec13.x + vec13.y*vec13.y + vec13.z*vec13.z);

	cos213 = (vec12.x * vec13.x + vec12.y * vec13.y + vec12.z * vec13.z)/(mod12 * mod13);
	double dist12 = mod13 * cos213;
	vec12.normalize();
	vec12 = vec12 * dist12;
	pt2 = pt1 + vec12;
	
	FdVector3d vec23 = pt3 - pt2;
	vec23.normalize();
	vec23 = vec23 * dSnailRadiusMin;
	pt3 = pt2 + vec23;

	normal.set(0, 1, 0);
	upVec = pt2 - pt3;
	upVec.normalize();
	sweepAngle = 100;
	
	makeDonutSection(pt3, normal, upVec, dSnailRadiusMin, snailZ, sweepAngle, tubeComplexQuad, segmentation);

	const int InBendSegments = 1;
	centers[0] = pt1;
	centers[1] = pt2;
	
	diams[0][0] = snailZ;	diams[0][1]	= diams[0][0];
	diams[1][0] = snailZ;	diams[1][1]	= diams[1][0];
	
	normals[0].set(-1, 0, 0);
	upVectors[0].set(0, 0, -1);

	normals[1] = vec12;
	upVectors[1] = upVec;

	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, InBendSegments, false, true);

//engine
	const int engineSegments = 14;
	const double engineMainSizeZ = L2 * 2.0/3.0;
	const double engineTransSizeZ = L2 - engineMainSizeZ;		//transition from main part to snail
	
	centers[ 0].set(0, 0, L2);								//top disk
	centers[ 1].set(0, 0, L2);								//top part of main engine
	centers[ 2].set(0, 0, centers[1].z - (engineMainSizeZ * 0.1));	//ring (midle part with radiator feets)
	centers[ 3].set(0, 0, centers[2].z);							//midle part tube
	centers[ 4].set(0, 0, centers[3].z - (engineMainSizeZ * 0.8));	//ring (midle end)
	centers[ 5].set(0, 0, centers[4].z);							//start transition to snail
	centers[ 6].set(0, 0, centers[5].z - (engineMainSizeZ * 0.05));	//ring
	centers[ 7].set(0, 0, centers[6].z);							//thin part
	centers[ 8].set(0, 0, centers[7].z - (engineTransSizeZ * 0.65));//ring
	centers[ 9].set(0, 0, centers[8].z);							//end transition to snail
	centers[10].set(0, 0, centers[9].z - (engineTransSizeZ * 0.2));	//rest cone
	centers[11].set(0, 0, 0);										//ring inside snail
	centers[12].set(0, 0, 0);										//inside snail
	centers[13].set(0, 0, -dn * 0.75);						//part under snail
	centers[14].set(0, 0, -dn * 0.75);						//finish disk
	

	makeVent(centers[0], vz, vx, dn4/2*0.8, false);
	
	const int engineMiddleD    = (int) (0.8 * dn4);
	const int engineTransD     = (int) (1.2 * dn4);
	const int engineTransThinD = (int) (0.6 * dn4);
	diams[ 0][0] = 0.1;
	diams[ 1][0] = dn4;
	diams[ 2][0] = dn4;
	diams[ 3][0] = engineMiddleD;
	diams[ 4][0] = engineMiddleD;
	diams[ 5][0] = engineTransD;
	diams[ 6][0] = engineTransD;
	diams[ 7][0] = engineTransThinD;
	diams[ 8][0] = engineTransThinD;
	diams[ 9][0] = engineTransD;
	diams[10][0] = engineTransD;
	diams[11][0] = dSnailRadius * 2 + snailZ * 0.8;
	diams[12][0] = snailZ * 1.3;
	diams[13][0] = snailZ * 1.3;
	diams[14][0] = 0.1;

	for(int i=0; i <= engineSegments; i++)
	{
		normals[i].set(0, 0, -1);
		upVectors[i].set(1, 0, 0);

		diams[i][1]	= diams[i][0];
	}

	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, engineSegments, false, true);

	//transition between engine and snail

	const int detalizationLittleAng = 4;	//can be changed without changing anything else below
	const int pillarN = 4;				//CAN NOT be changed without changing anything else below
	const int pointsPerPillar = detalizationLittleAng + 1;
	const int pointsCount = pillarN*pointsPerPillar;

	FdPoint3d walls1[pointsCount];	//points on top ring
	FdPoint3d walls2[pointsCount];	//points on buttom ring

	for(int wall=1; wall <= 2; wall++)		//init points in walls1 and walls2
	{
		double stepLittleAng   = wall == 1 ? 20 : 30;
		FdPoint3d *currentWall = wall == 1 ? walls1 : walls2;
		double wallZ           = wall == 1 ? centers[7].z : centers[8].z;
		
		double stepBigAng		= 90 - stepLittleAng;
	
		double stepLittleAng1 = stepLittleAng / detalizationLittleAng;

		double stepLAngRad = stepLittleAng1 * ARX_PI / 180;
		double stepBAngRad = stepBigAng * ARX_PI / 180;

		double startAng    = 45 - stepLittleAng / 2;
		double startAngRad = startAng * ARX_PI / 180;
	
		double wallRadius = (engineTransD - 5)/2.0;		//'-5' to prevent triangulation inaccuracy
		FdVector3d vecR(wallRadius, 0, wallZ);
		vecR.rotateBy(startAngRad, -vz);

		for(int a1=0, i=-1; a1 < pillarN; a1++ )
		{	
			for(int a2=0; a2 < detalizationLittleAng; a2++ )
			{	
				currentWall[++i].set(vecR.x, vecR.y, vecR.z);
				vecR.rotateBy(stepLAngRad, -vz);
			}

			currentWall[++i].set(vecR.x, vecR.y, vecR.z);
			vecR.rotateBy(stepBAngRad, -vz);
		}
	}
	
	const int planesCountOutside = pillarN * detalizationLittleAng;
	const int planesCountInside  = pillarN;
	const int planesCount = planesCountOutside + planesCountInside;
	int connectionOrder[planesCount][2];	//indexes of points in walls1 and walls2
	int connectionOrderInside[pillarN][2] = { 0, 5, 1, 4, 2, 7, 3, 6 };
	int connectionOrderInsideTemp[pillarN*2];
	
	int nInside = -1, nOutside = 0;
	int nPillar = 0;
	for(int i=0; i < pointsCount; i++, nPillar++)
	{
		if(nPillar == 0)
			connectionOrderInsideTemp[++nInside] = i;
		
		if(nPillar == detalizationLittleAng)
		{
			connectionOrderInsideTemp[++nInside] = i;
			nPillar = -1;
		}
		else
		{
			connectionOrder[nOutside][0] = i;
			connectionOrder[nOutside][1] = i+1;
			++nOutside;
		}
	}

	for(int i=planesCountOutside; i < planesCount; i++, nPillar++)
	{
		connectionOrder[i][0] = connectionOrderInsideTemp[connectionOrderInside[i-planesCountOutside][0]];
		connectionOrder[i][1] = connectionOrderInsideTemp[connectionOrderInside[i-planesCountOutside][1]];
	}

	for(int i=0; i < planesCount; i++ )
	{
		FdPoint3d connection[4];
	
		connection[0] = walls1[ connectionOrder[i][0] ];
		connection[1] = walls1[ connectionOrder[i][1] ];
		connection[2] = walls2[ connectionOrder[i][1] ];
		connection[3] = walls2[ connectionOrder[i][0] ];
		
		makePlane(connection, true);
	}

	//engine radiator fins
	FdPoint3d fins[4];
	fins[0] = centers[3];
	fins[1] = centers[3];
	fins[2] = centers[4];
	fins[3] = centers[4];

	fins[2].z += engineMainSizeZ * 0.1;
	fins[3].z += engineMainSizeZ * 0.1;

	fins[0].y -= diams[2][0] / 2.0;
	fins[1].y += diams[2][0] / 2.0;
	fins[2].y += diams[2][0] / 2.0;
	fins[3].y -= diams[2][0] / 2.0;

	double finStep = diams[3][0] / 10;

	for(int j=0; j < 4; j++)
		fins[j].x -= finStep*3;
		
	makePlane(fins, true);
	for(int i=0; i < 6; i++)
	{
		for(int j=0; j < 4; j++)
			fins[j].x += finStep;

		makePlane(fins, true);
	}

	//second part of fins
	fins[0].x = -diams[2][0] / 2.0;
	fins[1].x = +diams[2][0] / 2.0;
	fins[2].x = +diams[2][0] / 2.0;
	fins[3].x = -diams[2][0] / 2.0;
				  
	for(int j=0; j < 4; j++)
		fins[j].y = -finStep*3;
				
	makePlane(fins, true);
	for(int i=0; i < 6; i++)
	{
		for(int j=0; j < 4; j++)
			fins[j].y += finStep;

		makePlane(fins, true);
	}

//electrical controls box
	const int elBoxSegments = 4;

	const double elBoxSizeX = L3 - dn4/2;
	const double elBoxSizeY = dn4 * 1.2;
	const double elBoxSizeZ = engineMainSizeZ * 0.75;

	const double elBoxFaceThickCoef = 0.25;
	
	const double elBoxSizeYFace = elBoxSizeY * 1.1;
	const double elBoxSizeZFace = elBoxSizeZ * 1.05;

	centers[0].set(-dn4/2, 0, L2 * 2.0/3.0);
	centers[1] = centers[0];
	centers[2] = centers[0];
	centers[3] = centers[0];

	centers[1].x -= elBoxSizeX * (1 - elBoxFaceThickCoef);
	centers[2].x = centers[1].x;

	centers[3].x -= elBoxSizeX;

	double tabWidth[elBoxSegments] = { elBoxSizeY, elBoxSizeY, elBoxSizeYFace, elBoxSizeYFace };
	double tabHeight[elBoxSegments] = { elBoxSizeZ, elBoxSizeZ, elBoxSizeZFace, elBoxSizeZFace };
	
	for(int i=0; i <= elBoxSegments; i++)
	{
		normals[i].set(-1, 0, 0);
		upVectors[i].set(0, 0, 1);
	}

	int nSides = elBoxSegments*4;
	bool* sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		sides[i] = true;

	int nEdges = elBoxSegments*2 + 1;
	bool (*edges)[4] = new bool[nEdges][4];
	for(int i=0; i < nEdges; i++)
		for(int j=0; j < 4; j++)
			edges[i][j] = true;

#ifndef FIX_BRX
	makeBox(elBoxSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
#else
	bool* _sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		_sides[i] = false;
		
	makeBox(elBoxSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
	makeBox(elBoxSegments-1, centers, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);

	delete [] _sides;
#endif

	delete [] sides;
	delete [] edges;
}
else if( type == 6 ) //pumps wilo Star
{
		ads_real a;	   //install size.				//stratos L
		ads_real b;	   //whole size by Z axis.		//stratos L2 == b-d
		ads_real c;	   //distance from center to engine (except drawing #3 - outside radius of connector )
		ads_real d;	   //outside radius of connector of drawing #1.
		ads_real e;	   //pump's center offset from output pipe (stratos L1).	// maybe take as a/2 for easy algorithm
		ads_real f;	   //size by axis X of narrowed connectors (used only for drawing #4).
		ads_real g;	   //distance from center by Y axis to end of electical control box.		//stratos L3
		ads_real h;	   //diameter platform under engine.										//stratos  dn4 * 1.1
		ads_real i;	   //whole size by Y axis with electical control box.
		ads_real k;	   //inside diameter of connector tube (used only for drawing #4).
		ads_real l;	   //outside diameter of narrowed connectors (used only for drawing #4)..
		ads_real m;	   // m + g should be == i, but not exactly. So I don't use m.
		// int drawing;  // different appearance

		ads_real dn;
		get_val("b", b), get_val("a", a), get_val("c", c), get_val("d", d), get_val("e", e), get_val("f", f), get_val("g", g), 
		get_val("h", h), get_val("i", i), get_val("k", k), get_val("l", l), get_val("m", m),  get_val("dn", dn);
// parameters of different models of pumps wilo Star
	/*struct ParametersWiloPumpStar
	{
		ads_real a;	   //install size.				//stratos L
		ads_real b;	   //whole size by Z axis.		//stratos L2 == b-d
		ads_real c;	   //distance from center to engine (except drawing #3 - outside radius of connector )
		ads_real d;	   //outside radius of connector of drawing #1.
		ads_real e;	   //pump's center offset from output pipe (stratos L1).	// maybe take as a/2 for easy algorithm
		ads_real f;	   //size by axis X of narrowed connectors (used only for drawing #4).
		ads_real g;	   //distance from center by Y axis to end of electical control box.		//stratos L3
		ads_real h;	   //diameter platform under engine.										//stratos  dn4 * 1.1
		ads_real i;	   //whole size by Y axis with electical control box.
		ads_real k;	   //inside diameter of connector tube (used only for drawing #4).
		ads_real l;	   //outside diameter of narrowed connectors (used only for drawing #4)..
		ads_real m;	   // m + g should be == i, but not exactly. So I don't use m.
		int		 drawing;	//different appearance

		ads_real dn;
	};
	const int nEquipment = 25;
	ParametersWiloPumpStar params[nEquipment] =
	{
		//a		b		c	d	e		f	g	h		i		k	l	m	drawing
		{ 127,	125,	24,	23,	64,		15,	81,	93.5,	128,	16,	22,	0,	4,	},	//star 3 BS 5
		{ 127,	125,	24,	23,	64,		15,	81,	93.5,	128,	22,	28,	0,	4,	},	//star 3 BS 7
		{ 152,	130,	18,	33,	76,		0,	81,	93.5,	128,	0,	0,	0,	3,	},	//star 5 BU
		{ 162,	150,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	2,	},	//star 5 BFX
		{ 162,	150,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	2,	},	//star 5 FX
		{ 127,	125,	24,	23,	64,		15,	81,	93.5,	128,	16,	22,	0,	4,	},	//star 8 BS 5
		{ 127,	125,	24,	23,	64,		15,	81,	93.5,	128,	22,	28,	0,	4,	},	//star 8 BS 7
		{ 152,	130,	18,	33,	76,		0,	81,	93.5,	128,	0,	0,	0,	3,	},	//star 11 BU
		{ 162,	134,	22,	34,	81,		0,	82,	93.5,	132,	0,	0,	0,	1,	},	//star 16 F
		{ 162,	150,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	2,	},	//star 16 FX
		{ 162,	150,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	2,	},	//star 16 BFX
		{ 216,	176,	33,	55,	108,	0,	82,	96,		130,	0,	0,	0,	2,	},	//star 17 FX
		{ 162,	134,	22,	34,	81,		0,	82,	93.5,	132,	0,	0,	0,	1,	},	//star 21 F
		{ 162,	150,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	2,	},	//star 21 FX
		{ 162,	150,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	2,	},	//star 21 BFX
		{ 152,	155,	32,	35,	76,		0,	82,	96,		130,	0,	0,	0,	3,	},	//star 30 BU
		{ 165,	153,	31,	34,	83,		0,	82,	96,		132,	0,	0,	50,	1,	},	//star 30 F
		{ 162,	136,	24,	34,	81,		0,	81,	93.5,	128,	0,	0,	52,	1,	},	//star 32 BF
		{ 162,	136,	24,	34,	81,		0,	81,	93.5,	128,	0,	0,	52,	1,	},	//star 32 F
		{ 162,	154,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	5,	},	//star S 16 F
		{ 162,	154,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	5,	},	//star S 16 FX
		{ 162,	154,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	5,	},	//star S 16 BFX
		{ 162,	154,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	5,	},	//star S 21 F
		{ 162,	154,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	5,	},	//star S 21 FX
		{ 162,	154,	22,	50,	81,		0,	81,	93.5,	128,	0,	0,	0,	5,	}	//star S 21 BFX
	};

//debug drawing { ----------------------------------
	short model;
	get_val("B", model);
	int nextEquipment = model;
	if( nextEquipment >= nEquipment )
		nextEquipment = 0;	//nEquipment-1;

	if( nextEquipment < 0 )
		nextEquipment = 0;
//debug drawing } ----------------------------------

	ParametersWiloPumpStar& param = params[nextEquipment];
	
//debug drawing { ----------------------------------
	ads_real magicDN;
	get_val("H", magicDN);
	
	if( magicDN == 320 )
		magicDN = 15;	//by default

	param.dn = magicDN;
//debug drawing } ----------------------------------*/

	ads_real distCenterToEngineEnd = b - d;
	ads_real dnEngine = h * 0.9;	//diam of engine.

//input/output connectors
	FdVector3d normal(1, 0, 0);
	FdVector3d upVec(0, 0, 1);

	const int connThickness = (int) (0.066 * a);

	const int connSegments = 3;
	const int maxArray = 15;
	FdPoint3d centers[maxArray] = {
				FdPoint3d(-e, 0, 0),						//disk outside
				FdPoint3d(-e, 0, 0),						//pipe dn
				FdPoint3d(-e + connThickness, 0, 0),		//disk inside
				FdPoint3d(-e + connThickness, 0, 0)
				};

	FdVector3d normals[maxArray] = { normal, normal, normal, normal };
	FdVector3d upVectors[maxArray] = { upVec, upVec, upVec, upVec };

	double diams[maxArray][2] = {
				0.1,		0.1,		//disk outside
				dn,	dn,	//pipe dn
				dn,	dn,	//disk inside
				0.1,		0.1
				};
	int tubeComplexQuad = 5;
				
	//left connector
	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, connSegments, false, true);

	for(int i=0; i <= connSegments; i++)
	{
		centers[i].x = a - e - (centers[i].x + e);
	}
	//right connector
	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, connSegments, false, true);
	
//snail part
	FdPoint3d center(0, 0, 0);
	normal.set(0, 0, 1);
	upVec.set(1, 0, 0);
	
	double dSnailDiam		= dnEngine;			//outside diameter
	double snailZ			= dSnailDiam / 4.0;
	double dSnailRadius		= (dSnailDiam - snailZ)/2.0 + 0.01;	//internal radius for using in method makeDonutSection

	double sweepAngle = 360;
	int segmentation = 20;
	makeDonutSection(center, normal, upVec, dSnailRadius, snailZ, sweepAngle, tubeComplexQuad, segmentation);

	//output bend
	double donutEndXY = sqrt(dSnailRadius*dSnailRadius/2);
	donutEndXY--;	//to avoid triangulation inaccuracy

	FdPoint3d pt1(-e + connThickness, 0, 0);	//DonutOutBend start
	FdPoint3d pt2(-donutEndXY, -donutEndXY, 0);		//DonutOutBend end (inside main donut)
	//FdPoint3d pt3(pt1.x, -1, 0);					//direction to center of DonutOutBend
	
	FdVector3d vec12 = pt2 - pt1;
	FdVector3d vec13(0, -1, 0);
	
	double mod12 = sqrt(vec12.x*vec12.x + vec12.y*vec12.y + vec12.z*vec12.z);
	double mod13 = sqrt(vec13.y*vec13.y);

	double cos213 = (vec12.y * vec13.y)/(mod12 * mod13);

	double dist12half = sqrt(vec12.x*vec12.x + vec12.y*vec12.y + vec12.z*vec12.z) / 2;
	double radiusDonutOutBend = dist12half / cos213;

	center.set(pt1.x, -radiusDonutOutBend, 0);
	normal.set(0, 0, -1);
	upVec.set(0, 1, 0);

	sweepAngle = asin(cos213) * 2;
	sweepAngle = sweepAngle * 180 / ARX_PI;
	segmentation = 5;

	makeDonutSection(center, normal, upVec, radiusDonutOutBend, snailZ, sweepAngle, tubeComplexQuad, segmentation);
	
	//input bend
	pt1.set(a - e - connThickness, 0, 0);	//InBend start
	pt2.set(0, 0, -snailZ);								//InBend end 
	FdPoint3d pt3(snailZ/2, 0, -snailZ/4);				//InBend center
	
	vec12 = pt2 - pt1;
	vec13 = pt3 - pt1;
	
	mod12 = sqrt(vec12.x*vec12.x + vec12.y*vec12.y + vec12.z*vec12.z);
	mod13 = sqrt(vec13.x*vec13.x + vec13.y*vec13.y + vec13.z*vec13.z);

	cos213 = (vec12.x * vec13.x + vec12.y * vec13.y + vec12.z * vec13.z)/(mod12 * mod13);
	double dist12 = mod13 * cos213;
	vec12.normalize();
	vec12 = vec12 * dist12;
	pt2 = pt1 + vec12;
	
	FdVector3d vec23 = pt3 - pt2;
	vec23.normalize();
	double radiusDonutInBend = snailZ/2.0 + 0.01;
	vec23 = vec23 * radiusDonutInBend;
	pt3 = pt2 + vec23;

	normal.set(0, 1, 0);
	upVec = pt2 - pt3;
	upVec.normalize();
	sweepAngle = 100;
	
	makeDonutSection(pt3, normal, upVec, radiusDonutInBend, snailZ, sweepAngle, tubeComplexQuad, segmentation);

	const int InBendSegments = 1;
	centers[0] = pt1;
	centers[1] = pt2;
	
	diams[0][0] = snailZ;	diams[0][1]	= diams[0][0];
	diams[1][0] = snailZ;	diams[1][1]	= diams[1][0];
	
	normals[0].set(-1, 0, 0);
	upVectors[0].set(0, 0, -1);

	normals[1] = vec12;
	upVectors[1] = upVec;

	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, InBendSegments, false, true);

//engine
	const int engineSegments = 11;
	const double engineAirOutDeepZ	= 2;								//deep of hole air output from pump
	const double enginePlatformZ	= 0.1 * (distCenterToEngineEnd - c);		//height of platform under engine
	const double engineMainSizeZ	= distCenterToEngineEnd - c;
	const double engineTransSizeZ	= c;							//transition from main part to snail
	
	centers[ 0].set(0, 0, distCenterToEngineEnd - engineAirOutDeepZ);	//air disk
	centers[ 1].set(0, 0, distCenterToEngineEnd - engineAirOutDeepZ);	//air pipe
	centers[ 2].set(0, 0, distCenterToEngineEnd);						//top ring
	centers[ 3].set(0, 0, distCenterToEngineEnd);						//main engine part
	centers[ 4].set(0, 0, distCenterToEngineEnd - engineMainSizeZ);		//ring 1 of platform under engine
	centers[ 5].set(0, 0, centers[4].z);								//pipe of platform under engine
	centers[ 6].set(0, 0, centers[5].z - enginePlatformZ);				//ring 2 of platform under engine 
	centers[ 7].set(0, 0, centers[6].z);								//transition to snail
	centers[ 8].set(0, 0, 0);											//ring inside snail
	centers[ 9].set(0, 0, 0);											//inside snail
	centers[10].set(0, 0, -snailZ * 0.5);								//part under snail
	centers[11].set(0, 0, centers[10].z);								//finish disk

	const int engineAirOutD = (int) (0.25 * dnEngine);  // diameter of hole air output from pump
	const int engineTransD  = (int) dnEngine;

	diams[ 0][0] = 0.1;
	diams[ 1][0] = engineAirOutD;
	diams[ 2][0] = engineAirOutD;
	diams[ 3][0] = dnEngine;
	diams[ 4][0] = dnEngine;
	diams[ 5][0] = h;
	diams[ 6][0] = h;
	diams[ 7][0] = engineTransD;
	diams[ 8][0] = dSnailRadius * 2 + snailZ * 0.8;
	diams[ 9][0] = dSnailRadius * 2;
	diams[10][0] = dSnailRadius * 2;
	diams[11][0] = 0.1;

	for(int i=0; i <= engineSegments; i++)
	{
		normals[i].set(0, 0, -1);
		upVectors[i].set(1, 0, 0);

		diams[i][1]	= diams[i][0];
	}

	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, engineSegments, false, true);

	makeVent(centers[2], vz, vx, 35, false);
//electrical controls box
	const int elBoxSegments = 2;

	const double elBoxSizeX = g - dnEngine/2;
	const double elBoxSizeY = dnEngine;
	const double elBoxSizeZ = engineMainSizeZ;
	
	centers[0].set(-dnEngine/2, 0, distCenterToEngineEnd - elBoxSizeZ/2);
	centers[1] = centers[0];

	centers[1].x -= elBoxSizeX;

	double tabWidth[elBoxSegments] = { elBoxSizeY, elBoxSizeY };
	double tabHeight[elBoxSegments] = { elBoxSizeZ, elBoxSizeZ };
	
	for(int i=0; i <= elBoxSegments; i++)
	{
		normals[i].set(-1, 0, 0);
		upVectors[i].set(0, 0, 1);
	}

	int nSides = elBoxSegments*4;
	bool* sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		sides[i] = true;

	int nEdges = elBoxSegments*2 + 1;
	bool (*edges)[4] = new bool[nEdges][4];
	for(int i=0; i < nEdges; i++)
		for(int j=0; j < 4; j++)
			edges[i][j] = true;

#ifndef FIX_BRX
	makeBox(elBoxSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
#else
	bool* _sides = new bool [nSides];
	for(int i=0; i < nSides; i++)
		_sides[i] = false;
		
	makeBox(elBoxSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
	makeBox(elBoxSegments-1, centers, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);

	delete [] _sides;
#endif

	delete [] sides;
	delete [] edges;
}
else if( type == 7 ) //pumps wilo SiBooster
{
		ads_real DN;	//diam of main I/O pipes						(from docs)
		ads_real DE;	//diam of engine (approximately)
		
		ads_real H1;	//full height									(from docs)
		ads_real H2;	//height from buttom to top of pumps			(from docs)
		ads_real H3;	//height from buttom to center of I/O pipes		(from docs)
		
		ads_real A1;	//Length of platform (axis X)					(from docs)
		ads_real A2;	//Length of main I/O pipes (axis X)				(from docs)

		ads_real B1;	//Length of platform (axis Y)					(from docs)
		ads_real B2;	//Length between main I/O pipes centers (axis Y)(from docs)

		short nEngins;	//number of engins
		get_val("nEngins", nEngins);
		bool bBoxDir = 0;  // direction of electrical control box. 0 - under pumps, 1 - other side from pumps.
		get_val("DN", DN), get_val("DE", DE), get_val("H1", H1), get_val("H2", H2), get_val("H3", H3), get_val("A1", A1), get_val("A2", A2), get_val("B1", B1),
		get_val("B2", B2);
// parameters of different models of pumps wilo SiBooster
	/*struct ParametersWiloPumpSiBooster
	{
		ads_real DN;	//diam of main I/O pipes						(from docs)
		ads_real DE;	//diam of engine (approximately)
		
		ads_real H1;	//full height									(from docs)
		ads_real H2;	//height from buttom to top of pumps			(from docs)
		ads_real H3;	//height from buttom to center of I/O pipes		(from docs)
		
		ads_real A1;	//Length of platform (axis X)					(from docs)
		ads_real A2;	//Length of main I/O pipes (axis X)				(from docs)

		ads_real B1;	//Length of platform (axis Y)					(from docs)
		ads_real B2;	//Length between main I/O pipes centers (axis Y)(from docs)

		short nEngins;	//number of engins
		bool  bBoxDir;	//direction of electrical control box. 0 - under pumps, 1 - other side from pumps.
	};
	const int nEquipment = 111;
	ParametersWiloPumpSiBooster params[nEquipment] =
	{
		//SiBooster-2 EXCEL 
		//DN		DE		H1			H2			H3		A1		A2			B1		B2	  nEngins bBoxDir
		{ 60.33,	191,	1677.03,	901,		179.69,	600,	623.7,		460,	870.73,		2, 0 },	//V20-05-1/1.5/VCE	[0]
		{ 60.33,	188,	1677.03,	1036,		179.69,	600,	623.7,		460,	870.73,		2, 1 },	//V20-10-1/3/VCE
		{ 60.33,	188,	1677.03,	1136,		179.69,	600,	623.7,		460,	870.73,		2, 1 },	//V20-14-1/4.3/VCE
		{ 60.33,	188,	1877.03,	1448,		179.69,	600,	623.7,		460,	870.73,		2, 1 },	//V20-18-1/5.7/VCE
		{ 60.33,	188,	1677.03,	889,		179.69,	600,	623.7,		460,	870.73,		2, 0 },	//V30-03-1/1.5/VCE
		{ 60.33,	188,	1677.03,	1011,		179.69,	600,	623.7,		460,	870.73,		2, 1 },	//V30-06-1/3/VCE
		{ 60.33,	188,	1677.03,	1124,		179.69,	600,	623.7,		460,	870.73,		2, 1 },	//V30-09-1/4.3/VCE
		{ 60.33,	188,	1677.03,	1448,		179.69,	600,	623.7,		460,	870.73,		2, 1 },	//V30-11-1/5.7/VCE
		{ 60.33,	188,	1677.03,	1448,		179.69,	600,	623.7,		460,	870.73,		2, 1 },	//V30-13-1/7.4/VCE
		{ 60.33,	188,	1677.03,	1523,		179.69,	600,	623.7,		460,	870.73,		2, 1 },	//V30-16-1/8.7/VCE
		{ 60.33,	188,	1677.03,	1771,		179.69,	600,	623.7,		460,	870.73,		2, 1 },	//V30-19-1/10.1/VCE	[10]
		{ 114.30,	175,	1677.03,	847,		190.75,	600,	803.4,		460,	1095.88,	2, 0 },	//V50-02-1/1.5/VCE
		{ 114.30,	175,	1677.03,	932.11,		190.75,	600,	803.4,		460,	1095.88,	2, 1 },	//V50-04-1/3/VCE
		{ 114.30,	182,	1677.03,	970.11,		190.75,	600,	803.4,		460,	1095.88,	2, 1 },	//V50-05-1/4.3/VCE
		{ 114.30,	184,	1897.03,	1277,		190.75,	1080,	1136.69,	510,	1095.88,	2, 1 },	//V50-07-1/5.7/VCE
		{ 114.30,	184,	1897.03,	1352,		190.75,	1080,	1136.69,	510,	1095.88,	2, 1 },	//V50-09-1/7.4/VCE
		{ 114.30,	188,	1897.03,	1412,		210.57,	1080,	1136.69,	510,	1029.20,	2, 1 },	//V50-10-1/8.7/VCE
		{ 114.30,	188,	1697.03,	1487,		210.57,	1080,	1136.69,	510,	1029.20,	2, 1 },	//V50-12-1/10.1/VCE
		{ 114.30,	188,	1677.14,	892.11,		190.75,	600,	803.4,		460,	1095.88,	2, 1 },	//V80-02-1/3/VCE
		{ 114.30,	175,	1677.14,	942.11,		190.75,	600,	803.4,		460,	1095.88,	2, 1 },	//V80-03-1/4.3/VCE
		{ 114.30,	179,	1897.03,	1224,		210.57,	1080,	1136.69,	510,	1095.88,	2, 1 },	//V80-04-1/5.7/VCE	[20]
		{ 114.30,	176,	1897.03,	1269.71,	210.57,	1080,	1136.69,	510,	1095.88,	2, 1 },	//V80-05-1/7.4/VCE
		//DN		DE		H1			H2			H3		A1		A2			B1		B2	  nEngins bBoxDir
		{ 114.30,	184,	1697.03,	1347,		210.57,	1080,	1136.69,	510,	1095.88,	2, 1 },	//V80-06-1/8.7/VCE
		{ 114.30,	180,	1697.03,	1397,		210.57,	1080,	1136.69,	510,	1095.88,	2, 1 },	//V80-07-1/10.1/VCE
		{ 108.20,	237,	1897.03,	887,		212.09,	1080,	1131.63,	510,	1093.88,	2, 0 },	//V110-01-1/3/VCE
		{ 108.20,	242,	1897.03,	887,		212.09,	1080,	1131.63,	510,	1093.88,	2, 0 },	//V110-02-1/4.3/VCE
		{ 108.20,	237,	1897.03,	1196,		212.09,	1080,	1136.69,	510,	1093.88,	2, 1 },	//V110-03-1/5.7/VCE
		{ 108.20,	237,	1897.03,	1196,		212.09,	1080,	1136.69,	510,	1093.88,	2, 1 },	//V110-03-1/7.4/VCE
		{ 108.20,	237,	1897.03,	1219,		212.09,	1080,	1136.69,	510,	1093.88,	2, 1 },	//V110-03-1/8.7/VCE
		{ 108.20,	237,	1897.03,	1269,		212.09,	1080,	1136.69,	510,	1093.88,	2, 1 },	//V110-04-1/10.1/VCE
		{ 161.47,	237,	1897.03,	856.06,		226.57,	1080,	1136.69,	510,	1199.65,	2, 0 },	//V190-01-1/4.3/VCE		[30]
		{ 161.47,	237,	1897.03,	1181.06,	226.57,	1080,	1141.45,	510,	1199.65,	2, 1 },	//V190-02/2-1/5.7/VCE
		{ 161.47,	237,	1897.03,	1190.12,	226.57,	1080,	1141.45,	510,	1199.65,	2, 1 },	//V190-02-1/7.4/VCE
		{ 161.47,	242,	1897.03,	1204.06,	226.57,	1080,	1141.45,	510,	1199.65,	2, 1 },	//V190-02-1/10.1/VCE
		{ 211.56,	242,	1897.03,	1122,		262.13,	1080,	1148.99,	510,	1273.60,	2, 1 },	//V270-01-1/5.7/VCE
		{ 211.56,	237,	1897.03,	1248,		262.13,	1080,	1148.99,	510,	1273.60,	2, 1 },	//V270-02/1-1/7.4/VCE
		{ 211.56,	237,	1897.03,	1271,		262.13,	1080,	1148.99,	510,	1273.60,	2, 1 },	//V270-02-1/10.1/VCE
		//SiBooster-3 EXCEL 
		//DN		DE		H1			H2			H3		A1		A2			B1		B2	  nEngins bBoxDir
		{ 73.03,	185,	1676.92,	900.89,		179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V20-05-1/1.5/VCE		[37]
		{ 73.03,	180,	1676.92,	1035.89,	179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V20-10-1/3/VCE
		{ 73.03,	180,	1676.92,	1135.89,	179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V20-14-1/4.3/VCE
		{ 73.03,	180,	1676.92,	1447.89,	179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V20-18-1/5.7/VCE		[40]
		{ 73.03,	180,	1676.92,	888.89,		179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V30-03-1/1.5/VCE
		{ 73.03,	180,	1676.92,	1010.89,	179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V30-06-1/3/VCE
		{ 73.03,	180,	1676.92,	1123.89,	179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V30-09-1/4.3/VCE
		{ 73.03,	180,	1676.92,	1447.89,	179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V30-11-1/5.7/VCE
		{ 73.03,	184,	1676.92,	1518.60,	179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V30-13-1/7.4/VCE
		{ 73.03,	184,	1876.92,	1620.89,	179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V30-16-1/8.7/VCE
		{ 73.03,	184,	1676.92,	1770.89,	179.58,	900,	930.35,		460,	895.17,		3, 1 },	//V30-19-1/10.1/VCE
		{ 114.30,	180,	1677.14,	847.11,		190.75,	900,	1103.40,	460,	1095.88,	3, 0 },	//V50-02-1/1.5/VCE
		{ 114.30,	180,	1677.14,	932.11,		190.75,	900,	1103.40,	460,	1095.88,	3, 1 },	//V50-04-1/3/VCE
		{ 114.30,	180,	1677.14,	970.11,		190.75,	900,	1103.40,	460,	1095.88,	3, 1 },	//V50-05-1/4.3/VCE		[50]
		{ 114.30,	183,	1897.03,	1277,		210.57,	1580,	1636.69,	510,	1095.88,	3, 1 },	//V50-07-1/5.7/VCE
		{ 114.30,	188,	1897.03,	1347.71,	210.57,	1580,	1636.69,	510,	1095.88,	3, 1 },	//V50-09-1/7.4/VCE
		{ 114.30,	181,	1897.03,	1412,		210.57,	1580,	1636.69,	510,	1029.20,	3, 1 },	//V50-10-1/8.7/VCE
		{ 114.30,	188,	1697.03,	1487,		210.57,	1580,	1636.69,	510,	1029.20,	3, 1 },	//V50-12-1/10.1/VCE
		{ 168.28,	177,	1697.03,	892.11,		210.57,	900,	1103.40,	460,	1146.68,	3, 1 },	//V80-02-1/3/VCE
		{ 168.28,	177,	1677.14,	942.11,		190.75,	900,	1103.40,	460,	1146.68,	3, 1 },	//V80-03-1/4.3/VCE
		{ 168.28,	183,	1897.03,	1224,		210.57,	1580,	1641.45,	510,	1146.68,	3, 1 },	//V80-04-1/5.7/VCE
		//DN		DE		H1			H2			H3		A1		A2			B1		B2	  nEngins bBoxDir
		{ 168.28,	183,	1897.03,	1269.71,	210.57,	1580,	1641.45,	510,	1146.68,	3, 1 },	//V80-05-1/7.4/VCE
		{ 168.28,	183,	1697.03,	1347,		210.57,	1580,	1641.45,	510,	1146.68,	3, 1 },	//V80-06-1/8.7/VCE
		{ 168.28,	185,	1697.03,	1397,		210.57,	1580,	1641.45,	510,	1146.68,	3, 1 },	//V80-07-1/10.1/VCE		[60]
		{ 161.47,	239,	1897.03,	887,		212.03,	1580,	1636.39,	510,	1144.68,	3, 0 },	//V110-01-1/3/VCE
		{ 161.47,	239,	1897.03,	887,		212.03,	1580,	1636.39,	510,	1144.68,	3, 0 },	//V110-02-1/4.3/VCE
		{ 161.47,	243,	1897.03,	1196,		212.03,	1580,	1641.45,	510,	1144.68,	3, 1 },	//V110-03-1/5.7/VCE
		{ 161.47,	243,	1897.03,	1196,		212.03,	1580,	1641.45,	510,	1144.68,	3, 1 },	//V110-03-1/7.4/VCE
		{ 161.47,	243,	1897.03,	1219,		212.03,	1580,	1641.45,	510,	1144.68,	3, 1 },	//V110-03-1/8.7/VCE
		{ 161.47,	237,	1897.03,	1269,		212.03,	1580,	1641.45,	510,	1144.68,	3, 1 },	//V110-04-1/10.1/VCE
		{ 211.56,	240,	1897.03,	856,		226.57,	1580,	1643.93,	510,	1249.29,	3, 0 },	//V190-01-1/4.3/VCE
		{ 211.56,	235,	1897.03,	1181,		226.57,	1580,	1648.99,	510,	1249.29,	3, 1 },	//V190-02/2-1/5.7/VCE
		{ 211.56,	242,	1897.03,	1197,		226.57,	1580,	1648.99,	510,	1249.29,	3, 1 },	//V190-02-1/7.4/VCE
		{ 211.56,	235,	1897.03,	1204,		226.57,	1580,	1648.99,	510,	1249.29,	3, 1 },	//V190-02-1/10.1/VCE	[70]
		{ 211.46,	238,	1897.03,	1122,		262.13,	1580,	1643.93,	510,	1294.28,	3, 0 },	//V270-01-1/5.7/VCE
		{ 211.46,	238,	1897.03,	1122,		262.13,	1580,	1648.99,	510,	1294.28,	3, 1 },	//V270-02/1-1/7.4/VCE
		{ 211.46,	238,	1897.03,	1271,		262.13,	1580,	1648.99,	510,	1294.28,	3, 1 },	//V270-02-1/10.1/VCE
		//SiBooster-4 EXCEL
		//DN		DE		H1			H2			H3		A1		A2			B1		B2	  nEngins bBoxDir
		{ 73.03,	183,	1676.92,	 900.89,	179.58,	1200,	1230.35,	460,	895.17,		4, 1 },	//V20-05-1/1.5/VCE		[74]
		{ 73.03,	183,	1676.92,	1035.89,	179.58,	1200,	1224.05,	460,	895.17,		4, 1 },	//V20-10-1/3/VCE
		{ 73.03,	183,	1676.92,	1135.89,	179.58,	1200,	1224.05,	460,	895.17,		4, 1 },	//V20-14-1/4.3/VCE
		{ 73.03,	183,	1676.92,	1447.89,	179.58,	1200,	1224.05,	460,	895.17,		4, 1 },	//V20-18-1/5.7/VCE
		{ 73.03,	176,	1676.92,	888.89,		179.58,	1200,	1224.05,	460,	895.17,		4, 1 },	//V30-03-1/1.5/VCE
		{ 73.03,	176,	1676.92,	1010.89,	179.58,	1200,	1224.05,	460,	895.17,		4, 1 },	//V30-06-1/3/VCE
		{ 73.03,	174,	1676.92,	1123.89,	179.58,	1200,	1224.05,	460,	895.17,		4, 1 },	//V30-09-1/4.3/VCE		[80]
		{ 73.03,	176,	1676.92,	1447.89,	179.58,	1200,	1224.05,	460,	895.17,		4, 1 },	//V30-11-1/5.7/VCE
		{ 73.03,	180,	1676.92,	1522.89,	179.58,	1200,	1224.05,	460,	895.17,		4, 1 },	//V30-13-1/7.4/VCE
		{ 73.03,	183,	1676.92,	1620.89,	179.58,	1200,	1224.05,	460,	895.17,		4, 1 },	//V30-16-1/8.7/VCE
		{ 73.03,	177,	1676.92,	1770.89,	179.58,	1200,	1224.05,	460,	895.17,		4, 1 },	//V30-19-1/10.1/VCE
		{ 168.28,	177,	1677.14,	847.11,		190.75,	1200,	1503.19,	460,	1146.68,	4, 0 },	//V50-02-1/1.5/VCE
		{ 168.28,	177,	1677.14,	932.11,		190.75,	1200,	1503.19,	460,	1146.68,	4, 1 },	//V50-04-1/3/VCE
		{ 168.28,	177,	1677.14,	970.11,		190.75,	1200,	1503.19,	460,	1146.68,	4, 1 },	//V50-05-1/4.3/VCE
		{ 168.28,	183,	1896.95,	1277,		210.57,	2080,	2141.45,	510,	1146.68,	4, 1 },	//V50-07-1/5.7/VCE
		{ 168.28,	183,	1896.95,	1347.71,	210.57,	2080,	2141.45,	510,	1146.68,	4, 1 },	//V50-09-1/7.4/VCE
		{ 168.28,	183,	1896.95,	1412,		210.57,	2080,	2141.45,	510,	1080,		4, 1 },	//V50-10-1/8.7/VCE		[90]
		//DN		DE		H1			H2			H3		A1		A2			B1		B2	  nEngins bBoxDir
		{ 168.28,	178,	1696.95,	1487,		210.57,	2080,	2141.45,	510,	1080,		4, 1 },	//V50-12-1/10.1/VCE
		{ 168.28,	181,	1677.14,	892.11,		190.75,	1200,	1503.19,	460,	1146.68,	4, 1 },	//V80-02-1/3/VCE
		{ 168.28,	175,	1677.14,	942.11,		190.75,	1200,	1503.19,	460,	1146.68,	4, 1 },	//V80-03-1/4.3/VCE
		{ 168.28,	177,	1896.95,	1224,		210.57,	2080,	2141.45,	510,	1146.68,	4, 1 },	//V80-04-1/5.7/VCE
		{ 168.28,	177,	1896.95,	1269.71,	210.57,	2080,	2141.45,	510,	1146.68,	4, 1 },	//V80-05-1/7.4/VCE
		{ 168.28,	177,	1696.95,	1347,		210.57,	2080,	2141.45,	510,	1146.68,	4, 1 },	//V80-06-1/8.7/VCE
		{ 168.28,	183,	1696.95,	1397,		210.57,	2080,	2141.45,	510,	1146.68,	4, 1 },	//V80-07-1/10.1/VCE
		{ 211.56,	245,	1897.03,	887,		212.09,	2080,	2143.93,	510,	1208.18,	4, 0 },	//V110-01-1/3/VCE
		{ 211.56,	239,	1897.03,	887,		212.09,	2080,	2143.93,	510,	1208.18,	4, 0 },	//V110-02-1/4.3/VCE
		{ 211.56,	231,	1897.03,	1196,		212.09,	2080,	2148.99,	510,	1208.18,	4, 1 },	//V110-03-1/5.7/VCE		[100]
		{ 211.56,	238,	1897.03,	1196,		212.09,	2080,	2148.99,	510,	1208.18,	4, 1 },	//V110-03-1/7.4/VCE
		{ 211.56,	238,	1897.03,	1219,		212.09,	2080,	2148.99,	510,	1208.18,	4, 1 },	//V110-03-1/8.7/VCE
		{ 211.56,	238,	1897.03,	1269,		212.09,	2080,	2148.99,	510,	1208.18,	4, 1 },	//V110-04-1/10.1/VCE
		{ 211.56,	238,	1897.03,	856,		226.57,	2080,	2143.93,	510,	1249.65,	4, 0 },	//V190-01-1/4.3/VCE
		{ 211.56,	238,	1897.03,	1181,		226.57,	2080,	2148.99,	510,	1249.65,	4, 1 },	//V190-02/2-1/5.7/VCE
		{ 211.56,	238,	1897.03,	1197,		226.57,	2080,	2148.99,	510,	1249.65,	4, 1 },	//V190-02-1/7.4/VCE
		{ 211.56,	238,	1897.03,	1204,		226.57,	2080,	2148.99,	510,	1249.65,	4, 1 },	//V190-02-1/10.1/VCE
		{ 211.46,	238,	1897.03,	1122,		262.13,	2080,	2148.99,	510,	1294.41,	4, 1 },	//V270-01-1/5.7/VCE
		{ 211.46,	238,	1897.03,	1122,		262.13,	2080,	2148.99,	510,	1294.41,	4, 1 },	//V270-02/1-1/7.4/VCE
		{ 211.46,	238,	1897.03,	1271,		262.13,	2080,	2148.99,	510,	1294.41,	4, 1 }	//V270-02-1/10.1/VCE	[110]
		//DN		DE		H1			H2			H3		A1		A2			B1		B2	  nEngins bBoxDir
	};

//debug drawing ----------------------------------
	short model;
	get_val("B", model);
	int nextEquipment = model;
	if( nextEquipment >= nEquipment )
		nextEquipment = 0;	//nEquipment-1;

	if( nextEquipment < 0 )
		nextEquipment = 0;
		


	//nextEquipment = 100;




//debug drawing ----------------------------------

	ParametersWiloPumpSiBooster& param = params[nextEquipment];*/

//init dimensions
	const int tubeComplexQuad = 5;
	int complexitiesTTX[2] = { tubeComplexQuad, tubeComplexQuad };	//complexities of Tube-Tube intersection
	FdVector3d normal(0, 0, -1);
	FdVector3d upVec(1, 0, 0);
	
	//init engine dimensions
	const int engineSegments = 7;
	FdPoint3d centersEngine[engineSegments];
	FdVector3d normalsEngine[engineSegments];
	FdVector3d upVectorsEngine[engineSegments];
	double diamsEngine[engineSegments][2];

	double partWidth	= A1/nEngins;	//along axis X
	double partLength	= B2 + DN;		//along axis Y

	//center of parts of SiBooster. Single part is pump with its pipes.
	FdPoint3d partCenter(-(A1 - partWidth)/2, 0, 0);

	ads_real platformH = H3 / 2.0;

	ads_real engine1D	= DE * 0.7;	//Diam of top engine part
	ads_real engine2D	= DE;			//Diam of thick middle engine part
	ads_real engine3D	= DE * 0.9;	//Diam of buttom engine part

	ads_real engineHFull	= H2 - platformH;	//full height of engine from platform to top
	ads_real engineConeH	= engineHFull * 0.03;	//Height of cones between engine parts
	ads_real engine4H		= H3;		//Height of buttom engine part (intersection with secondary pipe)

	ads_real engine1H	= DE * 1.5;		//Height of top engine part
	ads_real engine2H	=						//Height of thick engine part
			(engineHFull - engine1H - engineConeH - engine4H) / 3.0;
	ads_real engine3H	= 						//Height of middle engine part
			engineHFull - engine1H - engineConeH - engine2H - engineConeH - engine4H;	

	FdPoint3d engineCenter(partCenter);
	engineCenter.y -= engine2D/2;
	
	for(int i=0; i < engineSegments; i++ )
		centersEngine[i] = engineCenter;

	centersEngine[0].z = engineHFull - engine4H/2;			//top disk
	centersEngine[1].z = centersEngine[0].z;				//pipe of engine (part 1)
	centersEngine[2].z = centersEngine[1].z - engine1H;		//cone to thick engine
	centersEngine[3].z = centersEngine[2].z - engineConeH;	//pipe of thick engine (part 2)
	centersEngine[4].z = centersEngine[3].z - engine2H;		//cone to middle engine
	centersEngine[5].z = centersEngine[4].z - engineConeH;	//pipe of middle engine (part 3)
	centersEngine[6].z = centersEngine[5].z - engine3H - engine4H;	// last segment
	
	diamsEngine[0][0] = 0.1;		//top disk
	diamsEngine[1][0] = engine1D;	//pipe of engine (part 1)
	diamsEngine[2][0] = engine1D;	//cone to thick engine
	diamsEngine[3][0] = engine2D;	//pipe of thick engine (part 2)
	diamsEngine[4][0] = engine2D;	//cone to middle engine
	diamsEngine[5][0] = engine3D;	//pipe of middle engine (part 3)
	diamsEngine[6][0] = engine3D;	// last segment

	for(int i=0; i < engineSegments; i++)
	{
		normalsEngine[i]	= normal;
		upVectorsEngine[i]	= upVec;

		diamsEngine[i][1] = diamsEngine[i][0];
	}

	//init pipes
	ads_real pipeSecondaryDN = DN * 2/3;		//diameter of pipes which connect main IO pipes and pumps
	ads_real pipeValveD		 = pipeSecondaryDN/2;	//diameter of pipes under valve
	ads_real pipeValveLen	 = pipeValveD;			//length of main pipe of valve
	ads_real pumpIOLen		 = engine3D*0.6;		//length of pipes which input/output from pump (from pump center)
	ads_real pipeIOInterLen	 = DN*0.75 - pipeValveD/2;	//length of pipes which intersect main I/O pipes (from its center)
	ads_real valveLen		 = pipeIOInterLen + pipeValveD/2 + DN/2;		//length of valve
	ads_real connPumpD1		 =						//diam1 of connectors between valves and pumps
				(DN < engine4H - 10) ? DN : engine4H - 10;
	ads_real connPumpD2		 = connPumpD1 * 0.95;	//diam2 of connectors between valves and pumps
	ads_real connPumpLen	 = DN * 0.15;		//thickness of connectors between valves and pumps

	const int segments21 = 7;		// secondary simple tube segments, part 1 along -Y axis
	FdPoint3d centers21[segments21];
	FdVector3d normals21[segments21];
	FdVector3d upVectors21[segments21];
	double diams21[segments21][2];
	
	for(int i=0; i < segments21; i++ )
		centers21[i] = engineCenter;

	centers21[0].y -= pumpIOLen;					//disk
	centers21[1].y = centers21[0].y;				//pipe of connector1
	centers21[2].y = centers21[1].y - connPumpLen;	//ring to connector2
	centers21[3].y = centers21[2].y;				//pipe of connector2
	centers21[4].y = centers21[3].y - connPumpLen;	//ring to secondary pipe
	centers21[5].y = centers21[4].y;				//pipe secondary to valve
	centers21[6].y = -B2/2 + pipeIOInterLen;

	diams21[0][0] = 0.1;				//disk
	diams21[1][0] = connPumpD1;			//pipe of connector1
	diams21[2][0] = connPumpD1;			//ring to connector2
	diams21[3][0] = connPumpD2;			//pipe of connector2
	diams21[4][0] = connPumpD2;			//ring to secondary pipe
	diams21[5][0] = pipeSecondaryDN;	//pipe secondary to valve
	diams21[6][0] = pipeSecondaryDN;		
	
	normal.set(0, -1, 0);
	upVec.set(0, 0, 1);
	for(int i=0; i < segments21; i++)
	{
		normals21[i]	= normal;
		upVectors21[i]	= upVec;

		diams21[i][1] = diams21[i][0];
	}
	
	const int segments22 = 11;		// secondary simple tube segments, part 2 along +Y axis
	FdPoint3d centers22[segments22];
	FdVector3d normals22[segments22];
	FdVector3d upVectors22[segments22];
	double diams22[segments22][2];
	
	for(int i=0; i < segments22; i++ )
		centers22[i] = engineCenter;

	centers22[0].y += pumpIOLen;					//disk
	centers22[1].y = centers22[0].y;				//pipe of connector1
	centers22[2].y = centers22[1].y + connPumpLen;	//ring to connector2
	centers22[3].y = centers22[2].y;				//pipe of connector2
	centers22[4].y = centers22[3].y + connPumpLen;	//ring to secondary pipe
	centers22[5].y = centers22[4].y;				//pipe common to thick part
	centers22[10].y = B2/2 - pipeIOInterLen;

	double restPipeLen		= centers22[10].y - centers22[5].y;
	double thickPipeLen		= restPipeLen * 0.3;
	double thickPipeD		= pipeSecondaryDN * 1.4;
	double conePipeLen		= restPipeLen * 0.05;
	double commonPipeLen	= restPipeLen  - conePipeLen*2 - thickPipeLen;
	
	centers22[6].y = centers22[5].y + commonPipeLen/2;	//cone to thick pipe
	centers22[7].y = centers22[6].y + conePipeLen;		//thick pipe
	centers22[8].y = centers22[7].y + thickPipeLen;		//cone to common pipe
	centers22[9].y = centers22[8].y + conePipeLen;		//pipe secondary to valve

	diams22[0][0] = 0.1;				//disk
	diams22[1][0] = connPumpD1;			//pipe of connector1
	diams22[2][0] = connPumpD1;			//ring to connector2
	diams22[3][0] = connPumpD2;			//pipe of connector2
	diams22[4][0] = connPumpD2;			//ring to secondary pipe
	diams22[5][0] = pipeSecondaryDN;	//pipe secondary to thick part
	diams22[6][0] = pipeSecondaryDN;	//cone to thick pipe
	diams22[7][0] = thickPipeD;			//thick pipe
	diams22[8][0] = thickPipeD;			//cone to common pipe
	diams22[9][0] = pipeSecondaryDN;	//pipe secondary to valve
	diams22[10][0] = pipeSecondaryDN;
	
	normal.set(0, 1, 0);
	for(int i=0; i < segments22; i++)
	{
		normals22[i]	= normal;
		upVectors22[i]	= upVec;

		diams22[i][1] = diams22[i][0];
	}

//drawing
	for(int part=1; part <= nEngins; part++)
	{
	//engine
		{
			makeTube(centersEngine, normalsEngine, upVectorsEngine, diamsEngine,
					tubeComplexQuad, engineSegments-1, false, true);
					
		//engine radiator fins
			const double finStep		= diamsEngine[1][0] / 10;
			const double finHalfWidth	= diamsEngine[1][0] * 1.1 / 2;
			FdPoint3d fins[4];
			{
				fins[0] = centersEngine[1];
				fins[1] = centersEngine[1];
				fins[2] = centersEngine[2];
				fins[3] = centersEngine[2];
			
				fins[0].z -= engine1H * 0.1;
				fins[1].z -= engine1H * 0.1;
				fins[2].z += engine1H * 0.2;
				fins[3].z += engine1H * 0.2;
				
				fins[0].y -= finHalfWidth;
				fins[1].y += finHalfWidth;
				fins[2].y += finHalfWidth;
				fins[3].y -= finHalfWidth;


				for(int j=0; j < 4; j++)
					fins[j].x -= finStep*3;
		
				makePlane(fins, true);
				for(int i=0; i < 6; i++)
				{
					for(int j=0; j < 4; j++)
						fins[j].x += finStep;

					makePlane(fins, true);
				}

				//second part of fins
				fins[0].x = centersEngine[1].x - finHalfWidth;
				fins[1].x = centersEngine[1].x + finHalfWidth;
				fins[2].x = centersEngine[2].x + finHalfWidth;
				fins[3].x = centersEngine[2].x - finHalfWidth;
			
				for(int j=0; j < 4; j++)
					fins[j].y = centersEngine[1].y - finStep*3;
				
				makePlane(fins, true);
				for(int i=0; i < 6; i++)
				{
					for(int j=0; j < 4; j++)
						fins[j].y += finStep;
					
					makePlane(fins, true);
				}
			}
		//individual electrical controls box of engine
			{
				const int elBoxSegments = 4;

				const double elBoxSizeX = finHalfWidth * 2;
				const double elBoxSizeY = diamsEngine[1][0];
				const double elBoxSizeZ = fins[1].z - fins[2].z;

				const double elBoxFaceThickCoef = 0.25;
	
				const double elBoxSizeYFace = elBoxSizeX * 1.1;
				const double elBoxSizeZFace = elBoxSizeZ * 1.05;

				FdPoint3d centers[elBoxSegments];
				centers[0] = centersEngine[1];
				centers[0].y -= finHalfWidth;
				centers[0].z = fins[2].z + (fins[1].z - fins[2].z) / 2;

				centers[1] = centers[0];
				centers[2] = centers[0];
				centers[3] = centers[0];

				centers[1].y -= elBoxSizeY * (1 - elBoxFaceThickCoef);
				centers[2].y = centers[1].y;

				centers[3].y -= elBoxSizeY;

				double tabWidth[elBoxSegments] = { elBoxSizeX, elBoxSizeX, elBoxSizeYFace, elBoxSizeYFace };
				double tabHeight[elBoxSegments] = { elBoxSizeZ, elBoxSizeZ, elBoxSizeZFace, elBoxSizeZFace };
	
				FdVector3d normals[elBoxSegments];
				FdVector3d upVectors[elBoxSegments];
				for(int i=0; i < elBoxSegments; i++)
				{
					normals[i].set(0, -1, 0);
					upVectors[i].set(0, 0, 1);
				}

				int nSides = elBoxSegments*4;
				bool* sides = new bool [nSides];
				for(int i=0; i < nSides; i++)
					sides[i] = true;

				int nEdges = elBoxSegments*2 + 1;
				bool (*edges)[4] = new bool[nEdges][4];
				for(int i=0; i < nEdges; i++)
					for(int j=0; j < 4; j++)
						edges[i][j] = true;

			#ifndef FIX_BRX
				makeBox(elBoxSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
			#else
				bool* _sides = new bool [nSides];
				for(int i=0; i < nSides; i++)
					_sides[i] = false;
		
				makeBox(elBoxSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
				makeBox(elBoxSegments-1, centers, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);

				delete [] _sides;
			#endif

				delete [] sides;
				delete [] edges;
			}
		}
	//pipe with engine intersection
		{
			normal.set(0, 0, -1);
			upVec.set(1, 0, 0);
			double tubeParams[3]		= { engine3D, engine3D, engine4H };	 //diamA, diamB, MainTubeLen
			double interTubePosition[2]	= { engine4H/2.0, 0 };	 //OffsetLR along main axis of tubetubeX, OffsetUD
			double interTubeParams[3]	= { pumpIOLen, pipeSecondaryDN, pipeSecondaryDN };	//InterTubeLen, diamA, diamB
			double angles[3]			= { 90, 90, 0 };		//AlphaLR, AlphaUD, Angle2
			bool   options[2]			= {	true, true };		//ShownBackHalfMainTube, MainTubeOmitted
	
			FdPoint3d start = centersEngine[engineSegments-1];
			start.z += engine4H;

			makeTubeToTubeIntersection(start, normal, upVec, tubeParams, 
					interTubePosition, interTubeParams, angles, complexitiesTTX, options);
					
			//second part
			angles[2] = 180;
			makeTubeToTubeIntersection(start, normal, upVec, tubeParams, 
					interTubePosition, interTubeParams, angles, complexitiesTTX, options);
		}
	//pipes from I/O part
		{
			normal.set(-1, 0, 0);
			upVec.set(0, 0, 1);
			double tubeParams[3]		= { DN, DN, partWidth };	 //diamA, diamB, MainTubeLen
			double interTubePosition[2]	= { partWidth/2.0, 0 };	 //OffsetLR along main axis of tubetubeX, OffsetUD											
			double interTubeParams[3]	= { pipeIOInterLen, pipeSecondaryDN, pipeSecondaryDN };	//InterTubeLen, diamA, diamB
			double angles[3]			= { 90, 90, 0 };		//AlphaLR, AlphaUD, Angle2
			bool   options[2]			= {	false, true };		//ShownBackHalfMainTube, MainTubeOmitted
			
			FdPoint3d start(partCenter.x + partWidth/2, -B2/2, 0);
			makeTubeToTubeIntersection( start, normal, upVec, tubeParams, 
					interTubePosition, interTubeParams, angles, complexitiesTTX, options);

			upVec.set(0, 0, -1);
			start.y = B2/2;
			makeTubeToTubeIntersection( start, normal, upVec, tubeParams, 
					interTubePosition, interTubeParams, angles, complexitiesTTX, options);

		//valve intersections 1 along -Y axis
			start.set(partCenter.x, -B2/2 + pipeIOInterLen, 0);
			normal.set(0, 1, 0);
			upVec.set(-1, 0, 0);
			tubeParams[0]			= pipeSecondaryDN;
			tubeParams[1]			= pipeSecondaryDN;
			tubeParams[2]			= pipeValveLen;
			interTubePosition[0]	= pipeValveD/2.0;
			interTubeParams[0]		= pipeSecondaryDN;
			interTubeParams[1]		= pipeValveD;
			interTubeParams[2]		= pipeValveD;

			makeTubeToTubeIntersection( start, normal, upVec, tubeParams, 
					interTubePosition, interTubeParams, angles, complexitiesTTX, options);
					
			//valve 1 along -Y axis
			FdPoint3d valveCenter(start.x, start.y + interTubePosition[0], start.z + interTubeParams[0]);
			double diameter = pipeValveD * 1.1;
			normal.set(0, 0, -1);
			makeDisc(valveCenter, normal, diameter, diameter/5, tubeComplexQuad, true);

			FdPoint3d valve[4];
			for(int j=0; j < 4; j++)
				valve[j] = valveCenter;
		
			valve[0].x -= valveLen;
			valve[1].x -= valveLen;

			valve[0].y -= diameter/4;
			valve[1].y += diameter/4;
			valve[2].y += diameter/4;
			valve[3].y -= diameter/4;

			makePlane(valve, true);
				

		//valve intersections 2 along +Y axis
			normal.set(0, -1, 0);
			upVec.set(1, 0, 0);
			start.y = B2/2 - pipeIOInterLen;
			makeTubeToTubeIntersection( start, normal, upVec, tubeParams, 
					interTubePosition, interTubeParams, angles, complexitiesTTX, options);
					
			//valve 2 along +Y axis
			valveCenter.y = start.y - interTubePosition[0];
			normal.set(0, 0, -1);
			makeDisc(valveCenter, normal, diameter, diameter/5, tubeComplexQuad, true);
			
			for(int j=0; j < 4; j++)
				valve[j] = valveCenter;
		
			valve[0].x += valveLen;
			valve[1].x += valveLen;

			valve[0].y -= diameter/4;
			valve[1].y += diameter/4;
			valve[2].y += diameter/4;
			valve[3].y -= diameter/4;

			makePlane(valve, true);

			// secondary simple tube segments, part 1 along -Y axis
			makeTube(centers21, normals21, upVectors21, diams21, tubeComplexQuad, segments21-1, false, true);	 	 
			
			// secondary simple tube segments, part 2 along +Y axis
			makeTube(centers22, normals22, upVectors22, diams22, tubeComplexQuad, segments22-1, false, true);
		}
	//feets of platform
		{
			normal.set(0, 0, -1);
			double diameter = engine3D / 3;

			FdPoint3d center(centersEngine[0].x, centersEngine[0].y - B1/2 + diameter/2, -H3 + platformH/4 );
			
			makeDisc(center, normal, diameter, platformH/2, tubeComplexQuad, true);

			center.y = centersEngine[0].y + B1/2 - diameter/2;
			makeDisc(center, normal, diameter, platformH/2, tubeComplexQuad, true);
		}

	//next part parameters
		partCenter.x += partWidth;
		
		for(int i=0; i < engineSegments; i++ )
			centersEngine[i].x = partCenter.x;

		for(int i=0; i < segments21; i++)
			centers21[i].x = partCenter.x;
			
		for(int i=0; i < segments22; i++)
			centers22[i].x = partCenter.x;
	}	//for parts

	
	//feets of main I/O pipes
	{
		const int segmentsFeets = 5;		// secondary simple tube segments, part 1 along -Y axis
		FdPoint3d centersFeets[segmentsFeets];
		FdVector3d normalsFeets[segmentsFeets];
		FdVector3d upVectorsFeets[segmentsFeets];
		double diamsFeets[segmentsFeets][2];
	
		centersFeets[0].set(0, 0, 0);

		for(int i=1; i < segmentsFeets; i++ )
			centersFeets[i] = centersFeets[0];

		centersFeets[0].z = -DN/2 + DN*0.05;	
		centersFeets[1].z = -H3 + H3 * 0.1;
		centersFeets[2].z = centersFeets[1].z;
		centersFeets[3].z = -H3;
		centersFeets[4].z = centersFeets[3].z;

		diamsFeets[0][0] = DN * 0.1;
		diamsFeets[1][0] = diamsFeets[0][0];
		diamsFeets[2][0] = diamsFeets[1][0] * 4;
		diamsFeets[3][0] = diamsFeets[2][0];
		diamsFeets[4][0] = 0.1;
	
		normal.set(0, 0, -1);
		upVec.set(1, 0, 0);
		for(int i=0; i < segmentsFeets; i++)
		{
			normalsFeets[i]		= normal;
			upVectorsFeets[i]	= upVec;

			diamsFeets[i][1] = diamsFeets[i][0];
		}

		const int nFeets = 6;
		FdPoint3d feets[nFeets];	//coordinates for all possible feets

		//4 feets  on distance 1/4 partWidth from main I/O pipe ends
		feets[0].set( -A2/2 + partWidth/4, -B2/2, 0 );
		feets[1].set( -A2/2 + partWidth/4, +B2/2, 0 );
		feets[2].set( +A2/2 - partWidth/4, -B2/2, 0 );
		feets[3].set( +A2/2 - partWidth/4, +B2/2, 0 );
		//2 central feet 
		feets[4].set( 0, -B2/2, 0 );
		feets[5].set( 0, +B2/2, 0 );
				
		for(int i=0; i < nFeets; i++)
		{
			if( nEngins != 4 && i > 3 )	//central feets only for equipment with 4 engins
				break;

			for(int j=0; j < segmentsFeets; j++)
				centersFeets[j].set( feets[i].x, feets[i].y, centersFeets[j].z );

			makeTube(centersFeets, normalsFeets, upVectorsFeets, diamsFeets, 
						tubeComplexQuad, segmentsFeets-1, false, true);
		}
	}

	//platform
	{
		const int platformSegments = 2;
				
		FdPoint3d centers[platformSegments];
		centers[0].set( 0, engineCenter.y, -H3 + platformH);
		centers[1].set( 0, engineCenter.y, -H3 + platformH/2);

		double tabWidth[platformSegments] = { B1, B1 };
		double tabHeight[platformSegments] = { A1, A1 };
	
		FdVector3d normals[platformSegments] = { FdVector3d(0, 0, -1), FdVector3d(0, 0, -1) };
		FdVector3d upVectors[platformSegments] = { FdVector3d(1, 0, 0), FdVector3d(1, 0, 0) };

		bool sides[4] = { false, true, false, true };

		int nEdges = platformSegments*2 + 1;
		bool (*edges)[4] = new bool[nEdges][4];
		for(int i=0; i < nEdges; i++)
			for(int j=0; j < 4; j++)
				edges[i][j] = true;

		makeBox(platformSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);

		delete [] edges;
	}

	//electrical controls box of whole equipment
	{
		//first feet
		const int feetSegments = 2;

		const double feetSizeX = 35;
		const double feetSizeY = 76;
		const double feetSizeZ = H1 - H3 + platformH;
		
		double elBoxSizeX = 600;
		double elBoxSizeY = 230;
		double elBoxSizeZ = 550;

		if( bBoxDir == 0 && elBoxSizeZ > (H1 - H2) )
			elBoxSizeZ = H1 - H2 - 50;	//prevent engins intersection with electrical Box

		FdPoint3d centers[feetSegments];
		centers[0].set(-A1/2 + feetSizeX/2, (engineCenter.y + B1/2)/2, -H3 + platformH );
		centers[1] = centers[0];

		centers[1].z += feetSizeZ;

		double tabWidth[feetSegments] = { feetSizeY, feetSizeY };
		double tabHeight[feetSegments] = { feetSizeX, feetSizeX };
	
		FdVector3d normals[feetSegments] = { FdVector3d(0, 0, 1), FdVector3d(0, 0, 1) };
		FdVector3d upVectors[feetSegments] = { FdVector3d(1, 0, 0), FdVector3d(1, 0, 0) };

		int nSides = feetSegments*4;
		bool* sides = new bool [nSides];
		for(int i=0; i < nSides; i++)
			sides[i] = true;

		int nEdges = feetSegments*2 + 1;
		bool (*edges)[4] = new bool[nEdges][4];
		for(int i=0; i < nEdges; i++)
			for(int j=0; j < 4; j++)
				edges[i][j] = true;

	#ifndef FIX_BRX
		makeBox(feetSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	#else
		bool* _sides = new bool [nSides];
		for(int i=0; i < nSides; i++)
			_sides[i] = false;
		
		makeBox(feetSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
		makeBox(feetSegments-1, centers, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);

		delete [] _sides;
	#endif

		//second feet
		centers[0].x += elBoxSizeX - feetSizeX;
		centers[1].x += elBoxSizeX - feetSizeX;
		
	#ifndef FIX_BRX
		makeBox(feetSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	#else
		_sides = new bool [nSides];
		for(int i=0; i < nSides; i++)
			_sides[i] = false;
		
		makeBox(feetSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
		makeBox(feetSegments-1, centers, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);

		delete [] _sides;
	#endif
		
		//electrical controls box
		centers[0].x -= (elBoxSizeX - feetSizeX)/2;
		centers[0].y += (bBoxDir ? 1 : -1) * (feetSizeY + elBoxSizeY)/2;
		centers[0].z = centers[1].z - elBoxSizeZ;

		centers[1] = centers[0];
		centers[1].z += elBoxSizeZ;

		tabWidth[0] = elBoxSizeY;
		tabWidth[1] = elBoxSizeY;
		
		elBoxSizeX *= 1.02;
		tabHeight[0] = elBoxSizeX;
		tabHeight[1] = elBoxSizeX;
				
	#ifndef FIX_BRX
		makeBox(feetSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, true, 0, 0, 0);
	#else
		_sides = new bool [nSides];
		for(int i=0; i < nSides; i++)
			_sides[i] = false;
		
		makeBox(feetSegments-1, centers, normals, upVectors, tabWidth, tabHeight, sides, edges, true, false, 0, 0, 0);
		makeBox(feetSegments-1, centers, normals, upVectors, tabWidth, tabHeight, _sides, edges, false, true, 0, 0, 0);

		delete [] _sides;
	#endif
		

		delete [] sides;
		delete [] edges;
	}

	//main I/O pipes with connectors
	{
		const int segmentsIOArray = 8;
		int segmentsIO = 0;
		FdPoint3d centersIO[segmentsIOArray];
		FdVector3d normalsIO[segmentsIOArray];
		FdVector3d upVectorsIO[segmentsIOArray];
		double diamsIO[segmentsIOArray][2];
	
		centersIO[0].set(-A2/2, -B2/2, 0);

		for(int i=1; i < segmentsIOArray; i++ )
			centersIO[i] = centersIO[0];
	
		if( DN > 114 )
		{	//draw connector
			double connX = 30;
			double connD = DN + DN * 2.0/3.0;
			segmentsIO = segmentsIOArray;
			centersIO[2].x = centersIO[1].x + connX;
			centersIO[3].x = centersIO[2].x;
			centersIO[4].x = centersIO[1].x + A2 - connX;
			centersIO[5].x = centersIO[4].x;
			centersIO[6].x = centersIO[5].x + connX;
			centersIO[7].x = centersIO[6].x;

			diamsIO[0][0] = 0.1;
			diamsIO[1][0] = connD;
			diamsIO[2][0] = connD;
			diamsIO[3][0] = DN;
			diamsIO[4][0] = DN;
			diamsIO[5][0] = connD;
			diamsIO[6][0] = connD;
			diamsIO[7][0] = 0.1;
		}
		else
		{
			segmentsIO = 4;
			centersIO[2].x = centersIO[0].x + A2;
			centersIO[3].x = centersIO[2].x;

			diamsIO[0][0] = 0.1;
			diamsIO[1][0] = DN;
			diamsIO[2][0] = DN;
			diamsIO[3][0] = 0.1;
		}

		normal.set(1, 0, 0);
		upVec.set(0, 0, 1);

		for(int i=0; i < segmentsIO; i++)
		{
			normalsIO[i]	= normal;
			upVectorsIO[i]	= upVec;

			diamsIO[i][1] = diamsIO[i][0];
		}
		
		//first IO pipe
		makeTube(centersIO, normalsIO, upVectorsIO, diamsIO, tubeComplexQuad, segmentsIO-1, false, true);

		//second IO pipe
		for(int i=0; i < segmentsIO; i++ )
			centersIO[i].y += B2;
			
		makeTube(centersIO, normalsIO, upVectorsIO, diamsIO, tubeComplexQuad, segmentsIO-1, false, true);

	}
}
else if( type == 8 ) //pumps wilo Rexa CUT
{
		ads_real DN1;	//diam of output connector
		ads_real DN21;	//diam of main part (top)
		ads_real DN22;	//diam of main part (center)
		ads_real DN23;	//diam of main part (buttom)
		ads_real DN3;	//diam of black part and snail
		ads_real DN4;	//diam of platform external		(from docs)
		ads_real DN41;	//diam of platform internal
		
		ads_real H1;	//full height					(from docs)
		ads_real H2;	//height of main part			(from docs)
		ads_real H3;	//height from buttom to center of black part		(from docs)
		ads_real H31;	//height of black part from center
		ads_real H32;	//thickness of snail
		ads_real H4;	//height of platform			(from docs)
		
		ads_real L1;	//distance from center to connector (along X axis)
		ads_real L2;	//thickness of connector
		get_val("DN1", DN1), get_val("DN21", DN21), get_val("DN22", DN22), get_val("DN23", DN23), get_val("DN3", DN3), get_val("DN4", DN4), get_val("DN41", DN41), get_val("H1", H1),
		get_val("H2", H2), get_val("H3", H3), get_val("H31", H31), get_val("H32", H32), get_val("H4", H4), get_val("L1", L1), get_val("L2", L2);
// parameters of different models of pumps wilo Rexa CUT
	/*struct ParametersWiloPumpRexaCUT
	{
		ads_real DN1;	//diam of output connector
		ads_real DN21;	//diam of main part (top)
		ads_real DN22;	//diam of main part (center)
		ads_real DN23;	//diam of main part (buttom)
		ads_real DN3;	//diam of black part and snail
		ads_real DN4;	//diam of platform external		(from docs)
		ads_real DN41;	//diam of platform internal
		
		ads_real H1;	//full height					(from docs)
		ads_real H2;	//height of main part			(from docs)
		ads_real H3;	//height from buttom to center of black part		(from docs)
		ads_real H31;	//height of black part from center
		ads_real H32;	//thickness of snail
		ads_real H4;	//height of platform			(from docs)
		
		ads_real L1;	//distance from center to connector (along X axis)
		ads_real L2;	//thickness of connector
	};
	const int nEquipment = 2;
	ParametersWiloPumpRexaCUT params[nEquipment] =
	{
		//DN1  DN21 DN22 DN23 DN3  DN4  DN41 H1	  H2   H3   H31	 H32 H4  L1  L2	
		{ 100, 132, 137, 140, 202, 310, 250, 605, 523, 193, 109, 46, 88, 144, 20,	}, // wilo Rexa-CUT 1.5kW
		{ 100, 132, 137, 140, 202, 310, 250, 691, 609, 193, 109, 46, 88, 144, 20,	}  // wilo Rexa-CUT 2.5kW
	};

//debug drawing ----------------------------------
	short model;
	get_val("B", model);
	int nextEquipment = model;
	if( nextEquipment >= nEquipment )
		nextEquipment = 0;	//nEquipment-1;

	if( nextEquipment < 0 )
		nextEquipment = 0;

//debug drawing ----------------------------------

	ParametersWiloPumpRexaCUT& param = params[nextEquipment];*/
	
//output connector
	FdVector3d normal(1, 0, 0);
	FdVector3d upVec(0, 0, 1);
	
	const int connSegments = 3;
	const int maxArray = 16;
	FdPoint3d centers[maxArray] = {
				FdPoint3d(L1, 0, 0),					//disk inside
				FdPoint3d(L1, 0, 0),					//pipe dn
				FdPoint3d(L1 + L2, 0, 0),		//disk outside
				FdPoint3d(L1 + L2, 0, 0)
				};

	FdVector3d normals[maxArray] = { normal, normal, normal, normal };
	FdVector3d upVectors[maxArray] = { upVec, upVec, upVec, upVec };

	double diams[maxArray][2] = {
				0.1,		0.1,		//disk outside
				DN1,	DN1,	//pipe dn
				DN1,	DN1,	//disk inside
				0.1,		0.1
				};

	const int tubeComplexQuad = 6;
	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, connSegments, false, true);

//snail part
	FdPoint3d center(0, 0, 0);
	normal.set(0, 0, 1);
	upVec.set(1, 0, 0);

	double dSnailDiam		= DN3;
	double snailZ			= H32;
	double dSnailRadius		= (dSnailDiam - snailZ)/2.0 + 0.01;	//internal radius for using in method makeDonutSection

	double sweepAngle = 360;
	int segmentation = tubeComplexQuad*4;
	makeDonutSection(center, normal, upVec, dSnailRadius, snailZ, sweepAngle, tubeComplexQuad, segmentation);

	//output bend
	double donutEndXY = sqrt(dSnailRadius*dSnailRadius/2);
	donutEndXY--;	//to avoid triangulation inaccuracy

	FdPoint3d pt1(L1, 0, 0);	//DonutOutBend start
	FdPoint3d pt2(donutEndXY, donutEndXY, 0);		//DonutOutBend end (inside main donut)
	//FdPoint3d pt3(pt1.x, 1, 0);					//direction to center of DonutOutBend
	
	FdVector3d vec12 = pt2 - pt1;
	FdVector3d vec13(0, 1, 0);
	
	double mod12 = sqrt(vec12.x*vec12.x + vec12.y*vec12.y + vec12.z*vec12.z);
	double mod13 = sqrt(vec13.y*vec13.y);

	double cos213 = (vec12.y * vec13.y)/(mod12 * mod13);

	double dist12half = sqrt(vec12.x*vec12.x + vec12.y*vec12.y + vec12.z*vec12.z) / 2;
	double radiusDonutOutBend = dist12half / cos213;

	center.set(pt1.x, radiusDonutOutBend, 0);
	normal.set(0, 0, -1);
	upVec.set(0, -1, 0);

	sweepAngle = asin(cos213) * 2;
	sweepAngle = sweepAngle * 180 / ARX_PI;
	segmentation = 5;

	makeDonutSection(center, normal, upVec, radiusDonutOutBend, snailZ, sweepAngle, tubeComplexQuad, segmentation);

//engine with input pipe
	const int engineSegments = 15;
	const double coneHeight = 5;
	const double engineMetallSizeZ = H2 - H3 + H31/2 - coneHeight * 2;

	centers[ 0].set(0, 0, H1);								//top disk
	centers[ 1].set(0, 0, H1);								//pipe of electic cable
	centers[ 2].set(0, 0, H2);								//ring electic cable - top of engine main part
	centers[ 3].set(0, 0, H2);								//pipe of top of engine main part
	centers[ 4].set(0, 0, centers[3].z - engineMetallSizeZ * 1/6);	//cone top - middle parts
	centers[ 5].set(0, 0, centers[4].z - coneHeight);				//pipe of middle of engine main part
	centers[ 6].set(0, 0, centers[5].z - engineMetallSizeZ * 3/6);	//cone middle - buttom parts
	centers[ 7].set(0, 0, centers[6].z - coneHeight);				//pipe of buttom of engine main part
	centers[ 8].set(0, 0, centers[7].z - engineMetallSizeZ * 2/6);	//ring of top of black part
	centers[ 9].set(0, 0, centers[8].z);							//pipe of black part
	centers[10].set(0, 0, centers[9].z - H31 * 1/7);			//ring to thin black part
	centers[11].set(0, 0, centers[10].z);							//pipe of thin black part
	centers[12].set(0, 0, -H32/2);							//ring donut - pump input
	centers[13].set(0, 0, centers[12].z);							//pipe pump input
	centers[14].set(0, 0, -H31/2);							//finish disk
	centers[15].set(0, 0, centers[14].z);

	const int diamBlackPart = (int) (0.8 * DN3);

	diams[ 0][0] = 0.1;					//top disk
	diams[ 1][0] = DN21 * 0.1;	//pipe of electic cable
	diams[ 2][0] = DN21 * 0.1;	//ring electic cable - top of engine main part
	diams[ 3][0] = DN21;			//pipe of top of engine main part
	diams[ 4][0] = DN21;			//cone top - middle parts
	diams[ 5][0] = DN22;			//pipe of middle of engine main part
	diams[ 6][0] = DN22;			//cone middle - buttom parts
	diams[ 7][0] = DN23;			//pipe of buttom of engine main part
	diams[ 8][0] = DN23;			//ring of top of black part
	diams[ 9][0] = DN3;			//pipe of black part
	diams[10][0] = DN3;			//ring to thin black part
	diams[11][0] = diamBlackPart;		//pipe of thin black part
	diams[12][0] = diamBlackPart;		//ring donut - pump input
	diams[13][0] = H31;			//pipe pump input
	diams[14][0] = H31;			//finish disk
	diams[15][0] = 0.1;

	for(int i=0; i <= engineSegments; i++)
	{
		normals[i].set(0, 0, -1);
		upVectors[i].set(1, 0, 0);

		diams[i][1]	= diams[i][0];
	}

	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, engineSegments, false, true);

//pillars in black part
	const int detalizationLittleAng = 2;	//can be changed without changing anything else below.
											//Note that complexity of donut, pipes, pillars and stepLittleAng
											//should be agreed upon to prevent triangulation issues.

	const int pillarN = 3;					//can be changed without changing anything else below
	const int centerPoints = 2;				//2 walls from outside to center of pump
	const int pointsPerPillar = detalizationLittleAng + 1 + centerPoints;

	double stepLittleAng	= 30;
	double wallZ			= centers[10].z;
		
	double stepBigAng		= 360/pillarN - stepLittleAng;
	
	double stepLittleAng1 = stepLittleAng / detalizationLittleAng;

	double stepLAngRad = stepLittleAng1 * ARX_PI / 180;
	double stepBAngRad = stepBigAng * ARX_PI / 180;

	double startAng    = -stepLittleAng / 2;
	double startAngRad = startAng * ARX_PI / 180;
	
	double wallRadius = (DN3 - 3)/2.0;		//'-3' to prevent triangulation inaccuracy
	FdVector3d vecR(-wallRadius, 0, wallZ);
	vecR.rotateBy(startAngRad, -vz);
	
	for(int a1=0; a1 < pillarN; a1++)
	{
		FdPoint3d walls[pointsPerPillar];	//points on ring
	//calc points
		walls[0].set(0, 0, wallZ);	//first wall
		
		//middle walls
		int i=0;
		for(int a2=0; a2 < detalizationLittleAng; a2++)
		{	
			walls[++i].set(vecR.x, vecR.y, vecR.z);
			vecR.rotateBy(stepLAngRad, -vz);
		}

		walls[++i].set(vecR.x, vecR.y, vecR.z);
		vecR.rotateBy(stepBAngRad, -vz);
			
		walls[++i].set(0, 0, wallZ);	//last wall

	//draw planes
		FdPoint3d connection[4];
		for(int i=0; i < pointsPerPillar-1; i++ )
		{
			connection[0] = walls[i];
			connection[1] = walls[i+1];
			connection[2] = walls[i+1];
			connection[3] = walls[i];
		
			connection[2].z = 0;
			connection[3].z = 0;

			makePlane(connection, true);
		}
	}

	// platform - 3 feet and ring
	stepLittleAng = 15;
	stepLAngRad   = stepLittleAng * ARX_PI / 180;
	stepBAngRad   = (360 / pillarN - stepLittleAng) * ARX_PI / 180;

	startAng      = -stepLittleAng / 2;
	startAngRad   = startAng * ARX_PI / 180;

	const int nWalls = pillarN*2;
	FdPoint3d walls1[nWalls];	//points on top ring
	FdPoint3d walls2[nWalls];	//points on buttom ring
	
	double diamPlatformInternal = (DN4 - (DN3 - DN21));
	double diamPlatformInternalPillars = diamPlatformInternal + 20;
	double platformRingZ = centers[14].z - H4;

	for(int wall=1; wall <= 2; wall++)		//init points in walls1 and walls2
	{
		FdPoint3d *currentWall = wall == 1 ? walls1 : walls2;
		wallZ                  = wall == 1 ? centers[14].z : platformRingZ;
		wallRadius             = wall == 1 ? diamBlackPart / 2 : diamPlatformInternalPillars / 2;

		vecR.set(wallRadius, 0, wallZ);
		vecR.rotateBy(startAngRad, -vz);

		for(int a1=0, i=-1; a1 < pillarN; a1++ )
		{	
			currentWall[++i].set(vecR.x, vecR.y, vecR.z);
			vecR.rotateBy(stepLAngRad, -vz);

			currentWall[++i].set(vecR.x, vecR.y, vecR.z);
			vecR.rotateBy(stepBAngRad, -vz);
		}
	}
	
	//draw vertical planes
	FdPoint3d connection[4];
	for(int i=0; i < nWalls; i+=2 )
	{
		connection[0] = walls1[i];
		connection[1] = walls1[i+1];
		connection[2] = walls1[i+1];
		connection[3] = walls1[i];
		
		connection[0].z = centers[12].z;
		connection[1].z = centers[12].z;

		makePlane(connection, true);
	}
	
	//draw inclined planes
	for(int i=0; i < nWalls; i+=2 )
	{
		connection[0] = walls1[i];
		connection[1] = walls1[i+1];
		connection[2] = walls2[i+1];
		connection[3] = walls2[i];
		
		makePlane(connection, true);
	}
	
	//ring of platform
	centers[0].set(0, 0, platformRingZ);
	centers[1].set(0, 0, platformRingZ);
	
	diams[0][0] = diamPlatformInternal;
	diams[0][1]	= diams[0][0];
	diams[1][0] = DN4;
	diams[1][1]	= diams[1][0];
	
	makeTube(centers, normals, upVectors, diams, tubeComplexQuad, 1, false, true);
}

	return 0;
	}

short CGeneralBlockCreator::makeCASS()
{
	ads_real a, b;
	ads_real h;
	ads_real d, l1;
	short ftype;
	short elType;

	get_val("A", a);
	get_val("B", b);
	get_val("H", h);
	get_val("d", d);
	get_val("l1", l1);

	get_val("ftype", ftype);

	get_val("elType", elType);

	FdPoint3d p_new_1(-a/2,0,0), p_new_2(-a/2+b*0.1,0,0);
	FdPoint3d P_new_1[] = { p_new_1, p_new_2 };

	FdPoint3d p_new_3(a/2,0,0), p_new_4(a/2-b*0.1,0,0);
	FdPoint3d P_new_2[] = { p_new_3, p_new_4 };

	FdPoint3d p_new_5(-a/2+b*0.1,0,0), p_new_6(a/2-b*0.1,0,0);
	FdPoint3d P_new_3[] = { p_new_5, p_new_6 };
	
	double tabWidth_new[2] = { h, h };
	double tabHeight_new_1[2] = { b*0.8, b };
	double tabHeight_new_2[2] = { b, b };

	// make box - the same for all objects?
	FdPoint3d p1(-a / 2, 0, 0), p2(a / 2, 0, 0);
	FdPoint3d p[2] = { p1, p2 };
	double tabWidth[2] = { h, h };
	double tabHeight[2] = { b, b };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };

	bool _sides[4] = { false, false, false, false };
	//makeBox(1, p, tabWidth, tabHeight, sides, con, true, false);
	//makeBox(1, p, tabWidth, tabHeight, _sides, con, false, true);

	makeBox(1, P_new_1, tabWidth_new, tabHeight_new_1, sides, con, true, true);
	makeBox(1, P_new_2, tabWidth_new, tabHeight_new_1, sides, con, true, true);
	makeBox(1, P_new_3, tabWidth_new, tabHeight_new_2, sides, con, true, true);

	FdPoint3d p_new_7(-a/2-b*.1,0,-h/2+h*.05), p_new_8(a/2+b*.1,0,-h/2+h*.05);
	FdPoint3d P_new_4[] = { p_new_7, p_new_8 };

	double tabWidth_new_3[2] = { h*.1, h*.1 };
	double tabHeight_new_3[2] = { b + b*.2, b + b*.2 };

	makeBox(1, P_new_4, tabWidth_new_3, tabHeight_new_3, sides, con, true, true);

	// front, back
	FdPoint3d ppc(0, 0, h / 2), pp1(-a / 4, 0, h / 2), pp2(a / 4, 0, h / 2);

	pp1.set(0, -b / 4, h / 2);  pp2.set(0, b / 4, h / 2);
	makeVent(pp1, vz, vy, min(a, b) / 6);  makeHSym(pp2, vz, vy, min(a, b) / 6, ftype);
	pp1.z = -h / 2;  pp2.z = -h / 2;
	makeVent(pp1, vz, vy, min(a, b) / 6);  makeHSym(pp2, vz, vy, min(a, b) / 6, ftype);

	return 0;
}





//////////////////////////////////////////////////////////////////// PE-PPSU(KANTHERM) ////////////////////////////////////////////////////////////////////

short CGeneralBlockCreator::makeTrojnik()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn3_in; get_val("dn3_in", dn3_in);
	ads_real l1_lib; get_val("l1_lib", l1_lib);
	ads_real l2_lib; get_val("l2_lib", l2_lib);
	ads_real l1_bis; get_val("l1_bis", l1_bis);
	ads_real l2_bis; get_val("l2_bis", l2_bis);
	ads_real l3; get_val("l3", l3);

	FdPoint3d p1(-l1_bis / 2, 0, 0);

	double tubeParams[3] = {dn1_in-2, dn1_in-2, l1_bis };
	double interTubePosition[2] = { l1_bis / 2, 0 };
	double interTubeParameters[3] = { l2_bis, dn1_in-2, dn1_in-2 };
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false,false,false };
	makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);
	
	// tube right
	FdPoint3d cp1(l1_bis / 2, 0, 0), cp2(l1_bis / 2 + thick1, 0, 0), cp3(l1_bis / 2+ thick1 + l3, 0, 0), cp4(l1_bis / 2 + thick1 + l3 + thick2, 0, 0);
	FdPoint3d cp[7] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4 };
	double diams[7] = { dn3_in, dn3_in, dn2_in, dn2_in, dn3_in, dn3_in, dn2_in};
	makeStraightTube(cp, diams, 10, 6, false);

	// tube left
	FdPoint3d cp1_b(-l1_bis / 2, 0, 0), cp2_b(-l1_bis / 2 - thick1, 0, 0), cp3_b(-l1_bis / 2 - thick1 - l3, 0, 0), cp4_b(-l1_bis / 2 - thick1 - l3 - thick2, 0, 0);
	FdPoint3d cp_2[7] = { cp1_b, cp2_b, cp2_b, cp3_b, cp3_b, cp4_b, cp4_b };
	double diams_2[7] = { dn3_in, dn3_in, dn2_in, dn2_in, dn3_in, dn3_in, dn2_in };
	makeStraightTube(cp_2, diams_2, 10, 6, false);

	FdPoint3d cp1_f(0, -l1_bis / 2, 0), cp2_f(0, -l1_bis / 2 - thick1, 0), cp3_f(0, -l1_bis / 2 - thick1 - l3, 0), cp4_f(0, -l1_bis / 2 - thick1 - l3 - thick2, 0);
	FdPoint3d cp_3[7] = { cp1_f, cp2_f, cp2_f, cp3_f, cp3_f, cp4_f, cp4_f };
	double diams_3[7] = { dn3_in, dn3_in, dn2_in, dn2_in, dn3_in, dn3_in, dn2_in };
	makeStraightTube(cp_3, diams_3, 10, 6, false);

	makeFlatRing(cp1, vx, dn3_in, dn1_in - 2, 10);
	makeFlatRing(cp1_b, vx, dn3_in, dn1_in - 2, 10);
	makeFlatRing(cp1_f, vy, dn3_in, dn1_in - 2, 10);
	
	return 0;
}

short CGeneralBlockCreator::makeTrojnik2()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real l1_lib; get_val("l1_lib", l1_lib);
	ads_real l2_lib; get_val("l2_lib", l2_lib);
	ads_real l1_bis; get_val("l1_bis", l1_bis);
	ads_real l2_bis; get_val("l2_bis", l2_bis);
	ads_real l3; get_val("l3", l3);
	ads_real l4; get_val("l4", l4);

	double l_front = l2_lib - l4 - l2_bis;

	FdPoint3d p1(-l1_bis / 2, 0, 0), p2, p3;

	double tubeParams[3] = { dn1_in-2, dn1_in-2, l1_bis };
	double interTubePosition[2] = { l1_bis / 2, 0 };
	double interTubeParameters[3] = { l2_bis, dn1_in - 2, dn1_in - 2};
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false,false,false };
	makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	FdPoint3d cp1(l1_bis / 2, 0, 0), cp2(l1_bis / 2 + thick1, 0, 0), cp3(l1_bis / 2 + thick1 + l3, 0, 0), cp4(l1_bis / 2 + thick1 + l3 + thick2, 0, 0);
	FdPoint3d cp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4 };
	double diams[] = { dn1_out, dn1_out, dn2_in, dn2_in, dn1_out, dn1_out, dn2_in };
	makeStraightTube(cp, diams, 10, 6, true);

	FdPoint3d cp1_b(-l1_bis / 2, 0, 0), cp2_b(-l1_bis / 2 - thick1, 0, 0), cp3_b(-l1_bis / 2 - thick1 - l3, 0, 0), cp4_b(-l1_bis / 2 - thick1 - l3 - thick2, 0, 0);
	FdPoint3d cp_2[] = { cp1_b, cp2_b, cp2_b, cp3_b, cp3_b, cp4_b, cp4_b };
	double diams_2[] = { dn1_out, dn1_out, dn2_in, dn2_in, dn1_out, dn1_out, dn2_in };
	makeStraightTube(cp_2, diams_2, 10, 6, true);

	FdPoint3d cp1_f(0, -l2_bis, 0), cp2_f(0, -l2_bis - l_front, 0), cp3_f(0, -l2_bis - l_front - l4, 0);
	FdPoint3d cp_3[] = { cp1_f, cp2_f, cp2_f, cp3_f, cp3_f};
	double diams_3[] = { dn1_in - 2, dn2_out, dn2_out, dn2_out, dn2_in };
	makeStraightTube(cp_3, diams_3, 10, 4, true);

	makeFlatRing(cp1, vx, dn1_out, dn1_in - 2, 10);
	makeFlatRing(cp1_b, vx, dn1_out, dn1_in - 2, 10);

	return 0;
}

short CGeneralBlockCreator::makeTrojnik3()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real l1_lib; get_val("l1_lib", l1_lib);
	ads_real l2_lib; get_val("l2_lib", l2_lib);
	ads_real l1_bis; get_val("l1_bis", l1_bis);
	ads_real l2_bis; get_val("l2_bis", l2_bis);
	ads_real l3; get_val("l3", l3);
	ads_real l4; get_val("l4", l4);

	double l_front = l2_lib - l4 - l2_bis;

	FdPoint3d p1(-l1_bis / 2, 0, 0), p2, p3;

	double tubeParams[3] = { dn1_in - 2, dn1_in - 2, l1_bis };
	double interTubePosition[2] = { l1_bis / 2, 0 };
	double interTubeParameters[3] = { l2_bis, dn1_in - 2, dn1_in - 2 };
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false,false,false };
	makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	FdPoint3d cp1(l1_bis / 2, 0, 0), cp2(l1_bis / 2 + thick1, 0, 0), cp3(l1_bis / 2 + thick1 + l3, 0, 0), cp4(l1_bis / 2 + thick1 + l3 + thick2, 0, 0);
	FdPoint3d cp[7] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4 };
	double diams[7] = { dn1_out, dn1_out, dn2_in, dn2_in, dn1_out, dn1_out, dn2_in };
	makeStraightTube(cp, diams, 10, 6, true);

	FdPoint3d cp1_b(-l1_bis / 2, 0, 0), cp2_b(-l1_bis / 2 - thick1, 0, 0), cp3_b(-l1_bis / 2 - thick1 - l3, 0, 0), cp4_b(-l1_bis / 2 - thick1 - l3 - thick2, 0, 0);
	FdPoint3d cp_2[7] = { cp1_b, cp2_b, cp2_b, cp3_b, cp3_b, cp4_b, cp4_b };
	double diams_2[7] = { dn1_out, dn1_out, dn2_in, dn2_in, dn1_out, dn1_out, dn2_in };
	makeStraightTube(cp_2, diams_2, 10, 6, true);

	FdPoint3d cp1_f(0, -l2_bis, 0), cp2_f(0, -l2_bis - l_front, 0), cp3_f(0, -l2_bis - l_front - l4, 0);
	FdPoint3d cp_3[7] = { cp1_f, cp2_f, cp2_f, cp3_f, cp3_f };
	double diams_3[7] = { dn1_in - 2, dn2_out, dn2_out, dn2_out, dn2_in };
	makeStraightTube(cp_3, diams_3, 10, 4, true);

	makeFlatRing(cp1, vx, dn1_out, dn1_in - 2, 10);
	makeFlatRing(cp1_b, vx, dn1_out, dn1_in - 2, 10);

	return 0;
}

short CGeneralBlockCreator::makeTrojnik4()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in); ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn1_in2; get_val("dn1_in2", dn1_in2);
	ads_real dn1_bis_in; get_val("dn1_bis_in", dn1_bis_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in); ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_in; get_val("dn3_in", dn3_in); ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real dn4_in; get_val("dn4_in", dn4_in);

	ads_real l1_lib; get_val("l1_lib", l1_lib); ads_real l2_lib; get_val("l2_lib", l2_lib);
	ads_real l1_bis; get_val("l1_bis", l1_bis); ads_real l2_bis; get_val("l2_bis", l2_bis);

	ads_real l1; get_val("l1", l1); ads_real l1_opt; get_val("l1_opt", l1_opt);
	ads_real l2; get_val("l2", l2); ads_real l3; get_val("l3", l3);

	ads_real dist1; get_val("dist1", dist1);
	
	FdPoint3d p1(-l1_bis / 2, 0, 0), p2, p3;

	//right
	double pr_x = l1_bis / 2;
	double pr2_x = dn1_bis_in > 0 ? pr_x + l1_opt : pr_x + thick1;
	double pr3_x = dn1_bis_in > 0 ? pr2_x + thick1 : pr2_x + l1;
	double pr4_x = dn1_bis_in > 0 ? pr3_x + l1 : pr3_x + thick2;
	double pr5_x = pr4_x + thick2;

	FdPoint3d cp1(pr_x, 0, 0), cp2(pr2_x, 0, 0), cp3(pr3_x, 0, 0), cp4(pr4_x, 0, 0), cp5(pr5_x, 0, 0);
	FdPoint3d cp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4 };
	FdPoint3d cp_alt[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5};

	double diams[] = { dn1_out, dn1_out, dn2_in, dn2_in, dn1_out, dn1_out };
	double diams_alt[] = { dn1_bis_in, dn1_bis_in, dn1_out, dn1_out, dn2_in, dn2_in, dn1_out, dn1_out };
	
	if (dn1_bis_in > 0) {
		makeStraightTube(cp_alt, diams_alt, 10, 8, true);
		makeFlatRing(cp1, vx, dn1_in - 2, dn1_bis_in - 2, 10);
	}
	else {
		makeStraightTube(cp, diams, 10, 5, true);
		makeFlatRing(cp1, vx, dn1_out, dn1_in - 2, 10);
	}

	//left
	FdPoint3d cp1_b(-l1_bis / 2, 0, 0), cp2_b(-l1_bis / 2 - thick1, 0, 0), cp3_b(-l1_bis / 2 - thick1 - l1, 0, 0), cp4_b(-l1_bis / 2 - thick1 - l1 - thick2, 0, 0);
	FdPoint3d cp_2[7] = { cp1_b, cp2_b, cp2_b, cp3_b, cp3_b, cp4_b, cp4_b };
	double diams_2[7] = { dn2_out, dn2_out, dn3_in, dn3_in, dn2_out, dn2_out };
	makeStraightTube(cp_2, diams_2, 10, 5, true);
	makeFlatRing(cp1_b, vx, dn2_out, dn1_in - 2, 10);

	//double pf_x = -l1_bis / 2 + dist1 + (dn1_in2 - 2) / 2;
	double pf_x = -l1_bis / 2 + dist1 + (dn1_in - 2) / 2;
	double pf1_y = -l2_bis;
	double pf2_y = pf1_y - thick1;
	double pf3_y = pf2_y -l1;
	double pf4_y = pf3_y - thick2;

	//front
	FdPoint3d cp1_f(pf_x, pf1_y, 0), cp2_f(pf_x, pf2_y, 0), cp3_f(pf_x, pf3_y, 0), cp4_f(pf_x, pf4_y, 0);
	FdPoint3d cp_3[7] = { cp1_f, cp2_f, cp2_f, cp3_f, cp3_f, cp4_f, cp4_f };
	double diams_3[7] = { dn3_out, dn3_out, dn4_in, dn4_in, dn3_out, dn3_out };
	makeStraightTube(cp_3, diams_3, 10, 5, true);

	makeFlatRing(cp1_f, vy, dn3_out, dn1_in2 - 2, 10);

	double tubeParams[] = { dn1_in - 2, dn1_in - 2, l1_bis };
	double interTubePosition[2] = { dist1 + (dn1_in - 2) / 2, 0 };
	double interTubeParameters[3] = {l2_bis, dn1_in2 - 2, dn1_in2 - 2 };
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false,false,false };
	makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	return 0;
}

short CGeneralBlockCreator::makeZlaczka1()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);

	ads_real dn1_out; get_val("dn1_out", dn1_out); ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out); ads_real dn4_out; get_val("dn4_out", dn4_out);

	ads_real l1; get_val("l1", l1); ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3); ads_real l4; get_val("l4", l4);

	double p1_x = 0; double p2_x = p1_x + l1; double p3_x = p2_x + l2 / 2; double p4_x = p3_x + l2 / 2;
	double p5_x = p4_x + l3; double p6_x = p5_x + thick1; double p7_x = p6_x + l4; double p8_x = p7_x + thick2;

	FdPoint3d cp1(p1_x, 0, 0), cp2(p2_x, 0, 0), cp3(p3_x, 0, 0), cp4(p4_x, 0, 0), cp5(p5_x , 0, 0),
		cp6(p6_x, 0, 0), cp7(p7_x, 0, 0), cp8(p8_x,0, 0);

	FdPoint3d cp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7, cp8, cp8 };
	double diams[] = { dn4_out, dn4_out, dn1_in, dn1_in, dn3_out, dn3_out, dn1_in, dn1_in, dn2_out, dn2_out, dn1_out, dn1_out, dn2_out, dn2_out };
	makeStraightTube(cp, diams, 15, 13, true);

	makeScrew(cp2, vx, vy, dn3_out, l2 / 2, false, false);

	return 0;
}

short CGeneralBlockCreator::makeZlaczka2()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);

	ads_real dn1_out; get_val("dn1_out", dn1_out); ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out); ads_real dn4_out; get_val("dn4_out", dn4_out);

	ads_real l1; get_val("l1", l1); ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3); ads_real l4; get_val("l4", l4);

	double p1_x = 0; double p2_x = p1_x + l1; double p3_x = p2_x + l2 / 2; double p4_x = p3_x + l2 / 2;
	double p5_x = p4_x + l3; double p6_x = p5_x + thick1; double p7_x = p6_x + l4; double p8_x = p7_x + thick2;

	FdPoint3d cp1(p1_x, 0, 0), cp2(p2_x, 0, 0), cp3(p3_x, 0, 0), cp4(p4_x, 0, 0), cp5(p5_x, 0, 0),
		cp6(p6_x, 0, 0), cp7(p7_x, 0, 0), cp8(p8_x, 0, 0);

	FdPoint3d cp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7, cp8, cp8 };
	double diams[] = { dn4_out, dn4_out, dn1_in, dn1_in, dn3_out, dn3_out, dn1_in, dn1_in, dn2_out, dn2_out, dn1_out, dn1_out, dn2_out, dn2_out };
	makeStraightTube(cp, diams, 15, 13, true);

	makeScrew(cp2, vx, vy, dn3_out, l2 / 2, false, false);

	return 0;
}

short CGeneralBlockCreator::makeZlaczka3()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);

	ads_real dn1_out; get_val("dn1_out", dn1_out); ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);

	ads_real l1; get_val("l1", l1); ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3); ads_real l4; get_val("l4", l4);

	double p1_x = 0; double p2_x = p1_x + l1; double p3_x = p2_x + l2; double p4_x = p3_x + l3;
	double p5_x = p4_x + thick1; double p6_x = p5_x + l4; double p7_x = p6_x + thick2;

	FdPoint3d cp1(p1_x, 0, 0), cp2(p2_x, 0, 0), cp3(p3_x, 0, 0), cp4(p4_x, 0, 0), 
		cp5(p5_x, 0, 0), cp6(p6_x, 0, 0), cp7(p7_x, 0, 0);

	FdPoint3d cp_2[] = {cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7};
	double diams_2[] = {dn1_in, dn1_in, dn3_out, dn3_out, dn1_in, dn1_in, dn2_out, dn2_out, dn1_out, dn1_out, dn2_out, dn2_out };

	makeStraightTube(cp_2, diams_2, 13, 11, true);

	makeScrew(cp1, vx, vy, dn3_out, l1, false, false);

	return 0;
}

short CGeneralBlockCreator::makeLacznik1()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn_in; get_val("dn_in", dn_in);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);

	ads_real l; get_val("l", l);
	ads_real l2; get_val("l2", l2);

	FdPoint3d cp1(0,0,0), cp2(thick2, 0, 0), cp3(thick2 + l2, 0, 0), cp4(thick2 + l2 + thick1, 0, 0), cp5(thick2 + l2 + thick1 + l, 0, 0),
		cp6(thick2 + l2 + thick1 + l + thick1, 0, 0), cp7(thick2 + l2 + thick1 + l + thick1 + l2, 0, 0), cp8(thick2 + l2 + thick1 + l + thick1 + l2 + thick2, 0, 0);

	FdPoint3d cp_2[] = {cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7, cp8, cp8};
	double diams[] = {dn2_out, dn2_out, dn3_out, dn3_out, dn2_out, dn2_out, dn_in, dn_in, dn2_out, dn2_out, dn3_out, dn3_out, dn2_out, dn2_out };

	makeStraightTube(cp_2, diams, 15, 13, true);
	return 0;
}

short CGeneralBlockCreator::makeLacznik2()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn_in; get_val("dn_in", dn_in);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);

	ads_real l; get_val("l", l);
	ads_real l2; get_val("l2", l2);

	FdPoint3d cp1(0, 0, 0), cp2(thick2, 0, 0), cp3(thick2 + l2, 0, 0), cp4(thick2 + l2 + thick1, 0, 0), cp5(thick2 + l2 + thick1 + l, 0, 0),
		cp6(thick2 + l2 + thick1 + l + thick1, 0, 0), cp7(thick2 + l2 + thick1 + l + thick1 + l2, 0, 0), cp8(thick2 + l2 + thick1 + l + thick1 + l2 + thick2, 0, 0);

	FdPoint3d cp_2[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7, cp8, cp8 };
	double diams[] = { dn2_out, dn2_out, dn3_out, dn3_out, dn2_out, dn2_out, dn_in, dn_in, dn2_out, dn2_out, dn3_out, dn3_out, dn2_out, dn2_out };

	makeStraightTube(cp_2, diams, 15, 13, true);
	return 0;
}

short CGeneralBlockCreator::makeLacznik3()
{

	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn3_in; get_val("dn3_in", dn3_in);
	ads_real dn4_in; get_val("dn4_in", dn4_in);

	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);

	ads_real l; get_val("l", l);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);

	FdPoint3d cp1(0, 0, 0), cp2(thick2, 0, 0), cp3(thick2 + l3, 0, 0),
		cp4(thick2 + l3 + thick1, 0, 0), cp5(thick2 + l3 + thick1 + l, 0, 0),
		cp6(thick2 + l3 + thick1 + l + l, 0, 0), cp7(thick2 + l3 + thick1 + l + l + thick1, 0, 0),
		cp8(thick2 + l3 + thick1 + l + l + thick1 + l2, 0, 0),
		cp9(thick2 + l3 + thick1 + l + l + thick1 + l2 + thick1, 0, 0);

	FdPoint3d cp_2[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7, cp8, cp8, cp9, cp9 };
	double diams[] = { dn2_out, dn2_out, dn4_in, dn4_in, dn2_out, dn2_out, dn3_in, dn3_in, dn1_in, dn1_in, dn1_out, dn1_out, dn2_in, dn2_in, dn1_out, dn1_out };

	makeStraightTube(cp_2, diams, 17, 15, true);
	return 0;
}

short CGeneralBlockCreator::makeLacznik4()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn3_in; get_val("dn3_in", dn3_in);
	ads_real dn4_in; get_val("dn4_in", dn4_in);

	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);

	ads_real l; get_val("l", l);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);

	FdPoint3d cp1(0, 0, 0), cp2(thick2, 0, 0), cp3(thick2 + l3, 0, 0),
		cp4(thick2 + l3 + thick1, 0, 0), cp5(thick2 + l3 + thick1 + l, 0, 0),
		cp6(thick2 + l3 + thick1 + l + l, 0, 0), cp7(thick2 + l3 + thick1 + l + l + thick1, 0, 0),
		cp8(thick2 + l3 + thick1 + l + l + thick1 + l2, 0, 0),
		cp9(thick2 + l3 + thick1 + l + l + thick1 + l2 + thick1, 0, 0);

	FdPoint3d cp_2[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7, cp8, cp8, cp9, cp9 };
	double diams[] = { dn2_out, dn2_out, dn4_in, dn4_in, dn2_out, dn2_out, dn3_in, dn3_in, dn1_in, dn1_in, dn1_out, dn1_out, dn2_in, dn2_in, dn1_out, dn1_out };

	makeStraightTube(cp_2, diams, 17, 15, true);
	return 0;
}

short CGeneralBlockCreator::makeKolano1()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real dn4_out; get_val("dn4_out", dn4_out);

	ads_real l; get_val("l", l);
	ads_real l2; get_val("l2", l2);

	ads_real alfa; get_val("alfa", alfa);

	FdPoint3d p(0, 0, 0);

	int n = 20;
	int seg = 1;

	double diams_1[] = { dn1_in - 2, dn1_in - 2 };
	double diams_2[] = { dn2_out, dn2_out };

	double r = 0.5 * dn2_out;

	makeDonutSection(p, vz, vy, r, dn2_out, alfa, n, n);
	makeDonutSection(p, vz, vy, r, dn1_in, alfa, n, n);

	double alfa2 = alfa * (ARX_PI / 180);
	p.set(0, dn2_out / 2, 0);

	FdPoint3d p1(-l, dn2_out / 2, 0), p2(l, dn2_out / 2, 0);
	FdPoint3d Left[] = { p.rotateBy(alfa2, vz), p1.rotateBy(alfa2, vz) };

	int alfa3 = 270 + (int) alfa;
	alfa = alfa3 * (ARX_PI / 180); // instead of alfa = alfa  ( ARX_PI / 180 );

	// outer tube
	FdPoint3d cp1(-dn2_out / 2, -l, 0), cp2(-dn2_out / 2, -l - thick1, 0),
		cp3(-dn2_out / 2, -l - thick1 - l2, 0), cp4(-dn2_out / 2, -l - thick1 - l2 - thick2, 0);

	FdPoint3d points[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4 };
	FdPoint3d points_alt[] = { cp1.rotateBy(alfa, vz), cp2.rotateBy(alfa, vz), cp2, cp3.rotateBy(alfa, vz),
		cp3, cp4.rotateBy(alfa, vz), cp4 };
	double diams_tube[] = { dn3_out, dn3_out, dn4_out, dn4_out, dn3_out, dn3_out };

	makeStraightTube(Left, diams_1, n, seg, true);
	makeStraightTube(Left, diams_2, n, seg, true);


	// outer tube

	if (alfa == 90) {
		makeStraightTube(points, diams_tube, 7, 5, true);
	}
	else {
		makeStraightTube(points_alt, diams_tube, 7, 5, true);
	}

	FdVector3d vv(vx);
	vv.rotateBy(alfa2, vz);
	makeFlatRing(p1, vv, dn3_out, dn2_out, n);

	p.set(0, dn2_out / 2, 0);
	FdPoint3d Right[] = { p.rotateBy(0, vz), p2.rotateBy(0, vz) };

	// outer tube
	FdPoint3d cp1_2(l, dn2_out / 2, 0), cp2_2(l + thick1, dn2_out / 2, 0),
		cp3_2(l + thick1 + l2, dn2_out / 2, 0), cp4_2(l + thick1 + l2 + thick2, dn2_out / 2, 0);

	FdPoint3d points_2[] = { cp1_2, cp2_2, cp2_2, cp3_2, cp3_2, cp4_2, cp4_2 };
	double diams_tube_2[] = { dn3_out, dn3_out, dn4_out, dn4_out, dn3_out, dn3_out };

	makeStraightTube(Right, diams_1, n, seg, true);
	makeStraightTube(Right, diams_2, n, seg, true);

	// outer tube
	makeStraightTube(points_2, diams_tube_2, 7, 5, true);

	makeFlatRing(p2, vx, dn3_out, dn2_out, n);

	return 0;
}

short CGeneralBlockCreator::makeKolano2()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real dist1; get_val("dist1", dist1);
	ads_real dist2; get_val("dist2", dist2);
	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);
	ads_real alfa; get_val("alfa", alfa);

	FdPoint3d p(0, 0, 0);

	int n = 20;
	int seg = 1;
	double diams_1[] = { dn1_in, dn1_in };
	double diams_2[] = { dn2_in, dn2_in };

	double r = 0.5 * dn2_in;

	makeDonutSection(p, vz, vy, r, dn2_in, alfa, n, n);
	makeDonutSection(p, vz, vy, r, dn1_in, alfa, n, n);

	double alfa2 = alfa * (ARX_PI / 180);
	p.set(0, dn2_in / 2, 0);

	FdPoint3d p1(-dist1, dn2_in / 2, 0), p2(dist2, dn2_in / 2, 0);
	FdPoint3d Left[] = { p.rotateBy(alfa2, vz), p1.rotateBy(alfa2, vz) };

	int alfa3 = 270 + (int) alfa;
	alfa = alfa3 * (ARX_PI / 180);

	// outer tube
	FdPoint3d cp1(-dn2_in / 2, -dist1, 0), cp2(-dn2_in / 2, -dist1 - l2, 0),
		cp3(-dn2_in / 2, -dist1 - l2 - l3, 0);

	FdPoint3d points[] = { cp1, cp2, cp2, cp3, cp3,};
	FdPoint3d points_alt[] = { cp1.rotateBy(alfa, vz), cp2.rotateBy(alfa, vz), cp2, cp3.rotateBy(alfa, vz),cp3 };
	double diams_tube[] = { dn2_in, dn3_out, dn3_out, dn3_out };

	makeStraightTube(Left, diams_1, n, seg, true);
	makeStraightTube(Left, diams_2, n, seg, true);

	if (alfa == 90) {
		makeStraightTube(points, diams_tube, 5, 3, true);
	}
	else {
		makeStraightTube(points_alt, diams_tube, 5, 3, true);
	}

	// outer tube
	//makeStraightTube(points, diams_tube, 5, 3, true);

	FdVector3d vv(vx);
	vv.rotateBy(alfa2, vz);

	//makeFlatRing(p1, vv, dn1_out, dn2_in, n);

	p.set(0, dn2_in / 2, 0);
	FdPoint3d Right[] = { p.rotateBy(0, vz), p2.rotateBy(0, vz) };

	// outer tube
	FdPoint3d cp1_2(dist2, dn2_in / 2, 0), cp2_2(dist2 + thick1, dn2_in / 2, 0),
		cp3_2(dist2 + thick1 + l1, dn2_in / 2, 0), cp4_2(dist2 + thick1 + l1 + thick2, dn2_in / 2, 0);

	FdPoint3d points_2[] = { cp1_2, cp2_2, cp2_2, cp3_2, cp3_2, cp4_2, cp4_2 };
	double diams_tube_2[] = { dn1_out, dn1_out, dn2_out, dn2_out, dn1_out, dn1_out };

	makeStraightTube(Right, diams_1, n, seg, true);
	makeStraightTube(Right, diams_2, n, seg, true);

	// outer tube
	makeStraightTube(points_2, diams_tube_2, 7, 5, true);

	makeFlatRing(p2, vx, dn1_out, dn2_in, n);
	return 0;
}

short CGeneralBlockCreator::makeKolano3()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real dn4_out; get_val("dn4_out", dn4_out);

	ads_real l; get_val("l", l);
	ads_real l2; get_val("l2", l2);

	FdPoint3d p(0, 0, 0);

	double alfa = 45;

	int n = 20;
	int seg = 1;
	double diams_1[] = { dn1_in, dn1_in };
	double diams_2[] = { dn2_out, dn2_out };

	double r = 0.5 * dn2_out;

	makeDonutSection(p, vz, vy, r, dn2_out, alfa, n, n);
	makeDonutSection(p, vz, vy, r, dn1_in, alfa, n, n);

	alfa = alfa * (ARX_PI / 180);
	p.set(0, dn2_out / 2, 0);

	FdPoint3d p1(-l, dn2_out / 2, 0), p2(l, dn2_out / 2, 0);
	FdPoint3d Left[] = { p.rotateBy(alfa, vz), p1.rotateBy(alfa, vz) };

	// outer tube
	FdPoint3d cp1(-dn2_out / 2 , -l, 0), cp2(-dn2_out / 2, -l - thick1, 0),
		cp3(-dn2_out / 2, -l - thick1 - l2, 0), cp4(-dn2_out / 2, -l - thick1 - l2 - thick2, 0);

	FdPoint3d points[] = { cp1.rotateBy(alfa, -vz), cp2.rotateBy(alfa, -vz), cp2, cp3.rotateBy(alfa, -vz),
		cp3, cp4.rotateBy(alfa, -vz), cp4 };
	double diams_tube[] = { dn3_out, dn3_out, dn4_out, dn4_out, dn3_out, dn3_out };

	makeStraightTube(Left, diams_1, n, seg, true);
	makeStraightTube(Left, diams_2, n, seg, true);

	// outer tube
	makeStraightTube(points, diams_tube, 7, 7, true);

	FdVector3d vv(vx);
	vv.rotateBy(alfa, vz);
	makeFlatRing(p1, vv, dn3_out, dn2_out, n);

	p.set(0, dn2_out / 2, 0);
	FdPoint3d Right[] = { p.rotateBy(0, vz), p2.rotateBy(0, vz) };

	// outer tube
	FdPoint3d cp1_2(l, dn2_out / 2, 0), cp2_2(l + thick1, dn2_out / 2, 0),
		cp3_2(l + thick1 + l2, dn2_out / 2, 0), cp4_2(l + thick1 + l2 + thick2, dn2_out / 2, 0);

	FdPoint3d points_2[] = { cp1_2, cp2_2, cp2_2, cp3_2, cp3_2, cp4_2, cp4_2 };
	double diams_tube_2[] = { dn3_out, dn3_out, dn4_out, dn4_out, dn3_out, dn3_out };

	makeStraightTube(Right, diams_1, n, seg, true);
	makeStraightTube(Right, diams_2, n, seg, true);

	// outer tube
	makeStraightTube(points_2, diams_tube_2, 7, 7, true);

	makeFlatRing(p2, vx, dn3_out, dn2_out, n);

	return 0;
}

short CGeneralBlockCreator::makePolsrubunek()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);

	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);

	FdPoint3d cp1(0, 0, 0), cp2(l1, 0, 0), cp3(l1 + l2, 0, 0), cp4(l1 + l2 + thick1, 0, 0), cp5(l1 + l2 + thick1 + l3, 0, 0),
		cp6(l1 + l2 + thick1 + l3 + thick2, 0, 0);

	FdPoint3d cp_2[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6};
	double diams[] = { dn1_in, dn1_in, dn1_in, dn1_in, dn1_out, dn1_out, dn1_in, dn1_in, dn1_out, dn1_out };

	makeStraightTube(cp_2, diams, 11, 10, true);

	makeScrew(cp1, vx, vy, dn2_out, l1, false, true);

	return 0;
}

short CGeneralBlockCreator::makeSrubunek()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);

	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);

	FdPoint3d cp1(0, 0, 0), cp2(l1, 0, 0), cp3(l1 + l2, 0, 0), cp4(l1 + l2 + thick1, 0, 0), cp5(l1 + l2 + thick1 + l3, 0, 0),
		cp6(l1 + l2 + thick1 + l3 + thick2, 0, 0);

	FdPoint3d cp_2[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6 };
	double diams[] = { dn1_in, dn1_in, dn1_in, dn1_in, dn1_out, dn1_out, dn1_in, dn1_in, dn1_out, dn1_out };

	makeStraightTube(cp_2, diams, 11, 10, true);

	makeScrew(cp1, vx, vy, dn2_out, l1, false, true);

	return 0;
}

short CGeneralBlockCreator::makeKolano4()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real dist1; get_val("dist1", dist1);
	ads_real dist2; get_val("dist2", dist2);
	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);
	ads_real alfa; get_val("alfa", alfa);

	FdPoint3d p(0, 0, 0);

	int n = 20;
	int seg = 1;
	double diams_1[] = { dn1_in, dn1_in };
	double diams_2[] = { dn2_in, dn2_in };

	double r = 0.5 * dn2_in;

	makeDonutSection(p, vz, vy, r, dn2_in, alfa, n, n);
	makeDonutSection(p, vz, vy, r, dn1_in, alfa, n, n);

	double alfa2 = alfa * (ARX_PI / 180);
	p.set(0, dn2_in / 2, 0);

	FdPoint3d p1(-dist1, dn2_in / 2, 0), p2(dist2, dn2_in / 2, 0);
	FdPoint3d Left[] = { p.rotateBy(alfa2, vz), p1.rotateBy(alfa2, vz) };

	int alfa3 = 270 + (int) alfa;
	alfa = alfa3 * (ARX_PI / 180);

	// outer tube
	FdPoint3d cp1(-dn2_in / 2, -dist1, 0), cp2(-dn2_in / 2, -dist1 - l2, 0);

	FdPoint3d points[] = { cp1, cp2, cp2 };
	FdPoint3d points_alt[] = { cp1.rotateBy(alfa, vz), cp2.rotateBy(alfa, vz), cp2 };
	double diams_tube[] = {dn3_out, dn3_out };

	makeStraightTube(Left, diams_1, n, seg, true);
	makeStraightTube(Left, diams_2, n, seg, true);

	if (alfa == 90) {
		makeStraightTube(points, diams_tube, 3, 1, true);
	}
	else {
		makeStraightTube(points_alt, diams_tube, 3, 1, true);
	}

	FdVector3d vv(vx);
	vv.rotateBy(alfa2, vz);

	makeFlatRing(p1, vv, dn1_out, dn2_in, n);

	p.set(0, dn2_in / 2, 0);
	FdPoint3d Right[] = { p.rotateBy(0, vz), p2.rotateBy(0, vz) };

	// outer tube
	FdPoint3d cp1_2(dist2, dn2_in / 2, 0), cp2_2(dist2 + thick1, dn2_in / 2, 0),
		cp3_2(dist2 + thick1 + l1, dn2_in / 2, 0), cp4_2(dist2 + thick1 + l1 + thick2, dn2_in / 2, 0);

	FdPoint3d points_2[] = { cp1_2, cp2_2, cp2_2, cp3_2, cp3_2, cp4_2, cp4_2 };
	double diams_tube_2[] = { dn1_out, dn1_out, dn2_out, dn2_out, dn1_out, dn1_out };

	makeStraightTube(Right, diams_1, n, seg, true);
	makeStraightTube(Right, diams_2, n, seg, true);

	// outer tube
	makeStraightTube(points_2, diams_tube_2, 7, 5, true);

	makeFlatRing(p2, vx, dn1_out, dn2_in, n);
	return 0;
}

short CGeneralBlockCreator::makeKolano5()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real box1_a; get_val("box1_a", box1_a);
	ads_real box2_a; get_val("box2_a", box2_a);
	ads_real box2_b; get_val("box2_b", box2_b);
	ads_real box_dist; get_val("box_dist", box_dist);
	ads_real box_h; get_val("box_h", box_h);
	ads_real tube_d; get_val("tube_d", tube_d);
	ads_real tube_h; get_val("tube_h", tube_h);
	ads_real tube_l; get_val("tube_l", tube_l);
	ads_real tube_l2; get_val("tube_l2", tube_l2);
	ads_real tube_d2; get_val("tube_d2", tube_d2);
	ads_real tube_d3; get_val("tube_d3", tube_d3);
	ads_real tube_d4; get_val("tube_d4", tube_d4);

	//main box
	bool sides_box[] = { true, true, true, true };
	bool conn[] = { false, false };

	double width[] = { box1_a, box1_a };
	double length[] = { box1_a, box1_a };

	FdPoint3d cp1(0, 0, 0), cp2(0, 0, box1_a);
	FdPoint3d cp_box_main[] = { cp1, cp2 };

	//side box
	bool sides_box_side[] = { true, true, true, true };
	bool conn_side[] = { false, false };

	double width_side[] = { box2_a, box2_a };
	double length_side[] = { box2_b, box2_b };

	FdPoint3d cp1_s1(0, 0, 0), cp2_s1(0, 0, box_h);

	FdPoint3d cp_box_side[] = { cp1_s1, cp2_s1 };

	makeBox(1, cp_box_main, width, length, sides_box, conn, true, true); //main box
	makeBox(1, cp_box_side, width_side, length_side, sides_box_side, conn_side, true, true); //side box

	//tubes
	FdPoint3d cp1_t1(0, 0, box1_a), cp2_t1(0, 0, box1_a + tube_h);
	//FdPoint3d cp1_top_1(0, 0, box1_a), cp2_top_1(0, 0, box1_a + tube_h);
	makeSimpleTube(cp1_t1, cp2_t1, tube_d, tube_d, 10);

	FdPoint3d cp_2[] = { cp1_t1, cp2_t1, cp2_t1};
	double diams[] = { tube_d, tube_d };

	FdPoint3d cp1_t2(0, -box1_a / 2, box1_a / 2), cp2_t2(0, -box1_a / 2 - tube_l, box1_a / 2), cp3_t2(0, -box1_a / 2 - tube_l - thick1, box1_a / 2),
		cp4_t2(0, -box1_a / 2 - tube_l - thick1 - tube_l2, box1_a / 2), cp5_t2(0, -box1_a / 2 - tube_l - thick1 - tube_l2 - thick2, box1_a / 2);

	FdPoint3d cp_3[] = { cp1_t2, cp2_t2, cp2_t2, cp3_t2, cp3_t2, cp4_t2, cp4_t2, cp5_t2, cp5_t2};
	double diams_2[] = { tube_d2, tube_d2, tube_d4, tube_d4, tube_d3, tube_d3, tube_d4, tube_d4 };

	//makeStraightTube(cp_2, diams, 3, 3, true);
	makeStraightTube(cp_3, diams_2, 7, 5, true);

	makeFlatRing(cp5_t2, vy, tube_d4, tube_d3, 10);

	return 0;
}

short CGeneralBlockCreator::makeKolano6()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real box1_a; get_val("box1_a", box1_a);
	ads_real box_dist; get_val("box_dist", box_dist);
	ads_real box2_a; get_val("box2_a", box2_a);
	ads_real box2_b; get_val("box2_b", box2_b);
	ads_real box_h; get_val("box_h", box_h);
	ads_real tube_d; get_val("tube_d", tube_d);
	ads_real tube_d2; get_val("tube_d2", tube_d2);
	ads_real tube_d3; get_val("tube_d3", tube_d3);
	ads_real tube_d4; get_val("tube_d4", tube_d4);
	ads_real tube_h; get_val("tube_h", tube_h);
	ads_real tube_l; get_val("tube_l", tube_l);
	ads_real tube_l2; get_val("tube_l2", tube_l2);

	//main box
	bool sides_box[] = { true, true, true, true };
	bool conn[] = { false, false };

	double width[] = { box1_a, box1_a };
	double length[] = { box1_a, box1_a };

	FdPoint3d cp1(0, 0, 0), cp2(0, 0, box1_a);
	FdPoint3d cp_box_main[] = { cp1, cp2 };

	FdPoint3d cp1_2(box1_a + box_dist, 0, 0), cp2_2(box1_a + box_dist, 0, box1_a);
	FdPoint3d cp_box_main2[] = { cp1_2, cp2_2 };

	//side box
	bool sides_box_side[] = { true, true, true, true };
	bool conn_side[] = { false, false };

	double width_side[] = { box2_a, box2_a };
	double length_side[] = { box2_b, box2_b };

	FdPoint3d cp1_s1((box1_a + box_dist) / 2, 0, 0), cp2_s1((box1_a + box_dist) / 2, 0, box_h);

	FdPoint3d cp_box_side[] = { cp1_s1, cp2_s1 };

	makeBox(1, cp_box_main, width, length, sides_box, conn, true, true); //main box
	makeBox(1, cp_box_main2, width, length, sides_box, conn, true, true); //main box
	makeBox(1, cp_box_side, width_side, length_side, sides_box_side, conn_side, true, true); //side box

	//tubes
	FdPoint3d cp1_top_1(0, 0, box1_a), cp2_top_1(0, 0, box1_a + tube_h);
	makeSimpleTube(cp1_top_1, cp2_top_1, tube_d, tube_d, 10);

	FdPoint3d cp1_top_2(box1_a + box_dist, 0, box1_a), cp2_top_2(box1_a + box_dist, 0, box1_a + tube_h);
	makeSimpleTube(cp1_top_2, cp2_top_2, tube_d, tube_d, 10);

	FdPoint3d cp1_t2(box1_a + box_dist, - box1_a / 2, box1_a / 2), cp2_t2(box1_a + box_dist, -box1_a / 2 - tube_l, box1_a / 2), cp3_t2(box1_a + box_dist, -box1_a / 2 - tube_l - thick1, box1_a / 2),
		cp4_t2(box1_a + box_dist, -box1_a / 2 - tube_l - thick1 - tube_l2, box1_a / 2), cp5_t2(box1_a + box_dist, -box1_a / 2 - tube_l - thick1 - tube_l2 - thick2, box1_a / 2);

	FdPoint3d cp_2[] = { cp1_t2, cp2_t2, cp2_t2, cp3_t2, cp3_t2, cp4_t2, cp4_t2, cp5_t2, cp5_t2 };

	FdPoint3d cp1_t3(0, -box1_a / 2, box1_a / 2), cp2_t3(0, -box1_a / 2 - tube_l, box1_a / 2), cp3_t3(0, -box1_a / 2 - tube_l - thick1, box1_a / 2),
		cp4_t3(0, -box1_a / 2 - tube_l - thick1 - tube_l2, box1_a / 2), cp5_t3(0, -box1_a / 2 - tube_l - thick1 - tube_l2 - thick2, box1_a / 2);

	FdPoint3d cp_3[] = { cp1_t3, cp2_t3, cp2_t3, cp3_t3, cp3_t3, cp4_t3, cp4_t3, cp5_t3, cp5_t3 };
	double diams_2[] = { tube_d3, tube_d3, tube_d2, tube_d2, tube_d4, tube_d4, tube_d2, tube_d2 };

	// donut
	FdPoint3d p((box1_a + box_dist) / 2, 0, box1_a + tube_h);
	double r = 0.5 * 15;
	makeDonutSection(p, -vy, vx, 25, tube_d, 180, 10, 10);

	makeStraightTube(cp_2, diams_2, 9, 7, true);
	makeStraightTube(cp_3, diams_2, 9, 7, true);

	makeFlatRing(cp5_t2, vy, tube_d2, tube_d3, 10);
	makeFlatRing(cp5_t3, vy, tube_d2, tube_d3, 10);

	return 0;
}

short CGeneralBlockCreator::makeKorek()
{

	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);

	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);

	FdPoint3d cp1(0, 0, 0), cp2(l1, 0, 0), cp3(l1 + thick1, 0, 0), cp4(l1 + thick1 + l2, 0, 0), cp5(l1 + thick1 + l2 + thick2, 0, 0);

	FdPoint3d cp_2[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5};
	double diams[] = { dn1_in, dn1_in, dn2_out, dn2_out, dn1_out, dn1_out, dn2_out, dn2_out };


	makeStraightTube(cp_2, diams, 9, 7, true);

	return 0;
}

short CGeneralBlockCreator::makeTrojnik5()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real dn4_out; get_val("dn4_out", dn4_out);

	ads_real l1_bis; get_val("l1_bis", l1_bis);
	ads_real l2_bis; get_val("l2_bis", l2_bis);

	FdPoint3d p1(-l1_bis / 2, 0, 0), p2, p3;

	FdPoint3d cp1(-l1_bis / 2, 0, 0), cp2(-l1_bis / 2 - thick1, 0, 0), cp3(-l1_bis / 2 - thick1 - 19.7, 0, 0), cp4(-l1_bis / 2 - thick1 - 19.7 - thick2, 0, 0);
	FdPoint3d cp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4 };
	double diams[] = { dn4_out, dn4_out, dn2_out, dn2_out, dn4_out, dn4_out };
	makeStraightTube(cp, diams, 7, 5, true);

	makeFlatRing(cp1, vx, dn4_out, dn1_in, 10);

	FdPoint3d cp1_b(l1_bis / 2, 0, 0), cp2_b(l1_bis / 2 + thick1, 0, 0), cp3_b(l1_bis / 2 + thick1 + 19.7, 0, 0), cp4_b(l1_bis / 2 + thick1 + 19.7 + thick2, 0, 0);
	FdPoint3d cp_2[] = { cp1_b, cp2_b, cp2_b, cp3_b, cp3_b, cp4_b, cp4_b };
	double diams_2[] = { dn3_out, dn3_out, dn1_out, dn1_out, dn3_out, dn3_out };
	makeStraightTube(cp_2, diams_2, 7, 5, true);

	makeFlatRing(cp1_b, vx, dn3_out, dn1_in, 10);

	double tubeParams[3] = { dn1_in, dn1_in, l1_bis };
	double interTubePosition[2] = { l1_bis / 2, 0 };
	double interTubeParameters[3] = { l2_bis + 8, dn2_in, dn2_in };
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false,false,false };
	makeTubeToTubeIntersection(p1, vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	makeFlatRing(cp4, vx, dn4_out, dn2_out, 10);
	makeFlatRing(cp4_b, vx, dn3_out, dn1_out, 10);

	return 0;
}

short CGeneralBlockCreator::makeZlaczka4()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);
	ads_real l4; get_val("l4", l4);

	if (l2 != 0) {
		FdPoint3d cp1(0, 0, 0), cp2(l1, 0, 0), cp3(l1 + l2, 0, 0), cp4(l1 + l2 + l3, 0, 0), cp5(l1 + l2 + l3 + thick1, 0, 0), 
				  cp6(l1 + l2 + l3 + thick1 + l4, 0, 0), cp7(l1 + l2 + l3 + thick1 + l4 + thick2, 0, 0);
		FdPoint3d cp[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5, cp6, cp6, cp7, cp7 };
		double diams[] = { dn2_out, dn2_out, dn2_out, dn1_in, dn1_in, dn1_in, dn1_out, dn1_out, dn2_in, dn2_in, dn1_out, dn1_out  };
		makeStraightTube(cp, diams, 13, 11, true);
	}
	else {
		FdPoint3d cp1(0, 0, 0), cp2(l1, 0, 0), cp3(l1 + thick1, 0, 0), cp4(l1 + thick1 + l4, 0, 0), cp5(l1 + thick1 + l4 + thick2, 0, 0);
		FdPoint3d cp_2[] = { cp1, cp2, cp2, cp3, cp3, cp4, cp4, cp5, cp5};
		double diams[] = { dn1_in, dn1_in, dn1_out, dn1_out, dn2_in, dn2_in, dn1_out, dn1_out };
		makeStraightTube(cp_2, diams, 9, 7, true);
	}

	return 0;
}

short CGeneralBlockCreator::makePodejscie1()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn3_in; get_val("dn3_in", dn3_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real dn4_out; get_val("dn4_out", dn4_out);
	ads_real l1_lib; get_val("l1_lib", l1_lib);
	ads_real l2_lib; get_val("l2_lib", l2_lib);
	ads_real l1_bis; get_val("l1_bis", l1_bis);
	ads_real l2_bis; get_val("l2_bis", l2_bis);
	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);
	ads_real l4; get_val("l4", l4);

	FdPoint3d p1(0, 0, 0), p2, p3;

	//top
	FdPoint3d cp1_t1(0, 0, l1_bis), cp2_t1(0, 0, l1_bis + l3);
	FdPoint3d cp_tube_1[] = { cp1_t1, cp2_t1 };
	makeSimpleTube(cp1_t1, cp2_t1, dn2_out, dn2_out, 10);
	makeFlatRing(cp1_t1, vz, dn2_out, dn1_in, 10);

	//bottom
	FdPoint3d cp1(0, 0, 0), cp2(0, 0, -l1), cp3(0, 0, - l1 - l2);
	FdPoint3d cp[] = { cp1, cp2, cp2, cp3, cp3 };
	double diams[] = { dn3_in, dn3_in, dn1_out, dn1_out };
	makeStraightTube(cp, diams, 5, 3, true);
	makeFlatRing(cp1, vz, dn1_in, dn3_in, 10);

	//front
	double h = l1_bis - dn2_in - dn2_in / 2;
	double p1_x = -l2_bis;
	double p2_x = p1_x - thick1;
	double p3_x = p2_x - l4;
	double p4_x = p3_x - thick2;

	FdPoint3d cp1_f(p1_x, 0, h), cp2_f(p2_x, 0, h), cp3_f(p3_x, 0, h), cp4_f(p4_x, 0, h);
	FdPoint3d cp_f[] = { cp1_f, cp2_f, cp2_f, cp3_f, cp3_f, cp4_f, cp4_f };
	double diams_f[] = { dn3_out, dn3_out, dn4_out, dn4_out, dn3_out, dn3_out };
	makeStraightTube(cp_f, diams_f, 5, 3, true);
	makeFlatRing(cp1_f, vx, dn2_in, dn3_out, 10);

	double tubeParams[3] = { dn1_in, dn1_in, l1_bis };
	double interTubePosition[2] = { l1_bis - dn2_in - dn2_in / 2, 0 };
	double interTubeParameters[3] = { l2_bis, dn2_in, dn2_in };
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false, false, false };
	makeTubeToTubeIntersection(p1, vz, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	return 0;
}

short CGeneralBlockCreator::makePodejscie2()
{	
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn3_in; get_val("dn3_in", dn3_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real dn4_out; get_val("dn4_out", dn4_out);
	ads_real l1_lib; get_val("l1_lib", l1_lib);
	ads_real l2_lib; get_val("l2_lib", l2_lib);
	ads_real l1_bis; get_val("l1_bis", l1_bis);
	ads_real l2_bis; get_val("l2_bis", l2_bis);
	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);
	ads_real l4; get_val("l4", l4);

	FdPoint3d p1(0, 0, 0), p2, p3;

	//top
	FdPoint3d cp1_t1(0, 0, l1_bis), cp2_t1(0, 0, l1_bis + l3);
	FdPoint3d cp_tube_1[] = { cp1_t1, cp2_t1 };
	makeSimpleTube(cp1_t1, cp2_t1, dn2_out, dn2_out, 10);
	makeFlatRing(cp1_t1, vz, dn2_out, dn1_in, 10);

	//bottom
	FdPoint3d cp1(0, 0, 0), cp2(0, 0, -l2), cp3(0, 0, -l2 - l3);
	FdPoint3d cp[] = { cp1, cp2, cp2, cp3, cp3 };
	double diams[] = { dn3_in, dn3_in, dn1_out, dn1_out };
	makeStraightTube(cp, diams, 5, 3, true);
	makeFlatRing(cp1, vz, dn1_in, dn3_in, 10);

	//front
	double h = dn2_in / 2;
	double p1_x = -l2_bis;
	double p2_x = p1_x - thick1;
	double p3_x = p2_x - l4;
	double p4_x = p3_x - thick2;

	FdPoint3d cp1_f(p1_x, 0, h), cp2_f(p2_x, 0, h), cp3_f(p3_x, 0, h), cp4_f(p4_x, 0, h);
	FdPoint3d cp_f[] = { cp1_f, cp2_f, cp2_f, cp3_f, cp3_f, cp4_f, cp4_f };
	double diams_f[] = { dn3_out, dn3_out, dn4_out, dn4_out, dn3_out, dn3_out };
	makeStraightTube(cp_f, diams_f, 5, 3, true);
	makeFlatRing(cp1_f, vx, dn2_in, dn3_in, 10);

	//front2
	FdPoint3d cp0_f2(0,0, h), cp1_f2(0, p1_x, h), cp2_f2(0, p2_x, h), cp3_f2(0, p3_x, h), cp4_f2(0, p4_x, h);
	FdPoint3d cp_f2[] = { cp0_f2, cp1_f2, cp1_f2, cp2_f2, cp2_f2, cp3_f2, cp3_f2, cp4_f2, cp4_f2 };
	double diams_f2[] = { dn2_in, dn2_in, dn3_out, dn3_out, dn4_out, dn4_out, dn3_out, dn3_out };
	makeStraightTube(cp_f2, diams_f2, 7, 5, true);

	double tubeParams[3] = { dn1_in, dn1_in, l1_bis };
	double interTubePosition[2] = { dn2_in / 2, 0 };
	double interTubeParameters[3] = { l2_bis, dn2_in, dn2_in };
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false, false, false };
	makeTubeToTubeIntersection(p1, vz, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	return 0;
}

short CGeneralBlockCreator::makePodejscie3()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn3_in; get_val("dn3_in", dn3_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real dn4_out; get_val("dn4_out", dn4_out);
	ads_real l1_lib; get_val("l1_lib", l1_lib);
	ads_real l2_lib; get_val("l2_lib", l2_lib);
	ads_real l1_bis; get_val("l1_bis", l1_bis);
	ads_real l2_bis; get_val("l2_bis", l2_bis);
	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);
	ads_real l4; get_val("l4", l4);

	FdPoint3d p1(0, 0, 0), p2, p3;

	//top
	FdPoint3d cp1_t1(0, 0, l1_bis), cp2_t1(0, 0, l1_bis + l3);
	FdPoint3d cp_tube_1[] = { cp1_t1, cp2_t1 };
	makeSimpleTube(cp1_t1, cp2_t1, dn2_out, dn2_out, 10);
	makeFlatRing(cp1_t1, vz, dn2_out, dn1_in, 10);
	makeFlatRing(cp2_t1, vz, dn2_out, dn1_in, 10);

	//bottom
	FdPoint3d cp1(0, 0, 0), cp2(0, 0, -l2), cp3(0, 0, -l2 - l1);
	FdPoint3d cp[] = { cp1, cp2, cp2, cp3, cp3 };
	double diams[] = { dn3_in, dn3_in, dn1_out, dn1_out };
	makeStraightTube(cp, diams, 5, 3, true);
	makeFlatRing(cp1, vz, dn1_in, dn3_in, 10);

	//front
	double h = dn2_in / 2;
	double p1_x = -l2_bis;
	double p2_x = p1_x - thick1;
	double p3_x = p2_x - 19.7;
	double p4_x = p3_x - thick2;

	FdPoint3d cp1_f(p1_x, 0, h), cp2_f(p2_x, 0, h), cp3_f(p3_x, 0, h), cp4_f(p4_x, 0, h);
	FdPoint3d cp_f[] = { cp1_f, cp2_f, cp2_f, cp3_f, cp3_f, cp4_f, cp4_f };
	double diams_f[] = { dn3_out, dn3_out, dn4_out - 2, dn4_out - 2, dn3_out, dn3_out };
	makeStraightTube(cp_f, diams_f, 5, 5, true);
	makeFlatRing(cp1_f, vx, dn3_in, dn3_out, 10);

	//front2
	FdPoint3d cp0_f2(-dn2_in / 2, 0, h), cp1_f2(-p1_x, 0, h), cp2_f2(-p2_x, 0, h), cp3_f2(-p3_x, 0, h), cp4_f2(-p4_x, 0, h);
	FdPoint3d cp_f2[] = { cp0_f2, cp1_f2, cp1_f2, cp2_f2, cp2_f2, cp3_f2, cp3_f2, cp4_f2, cp4_f2 };
	double diams_f2[] = { dn2_in, dn2_in, dn3_out, dn3_out, dn4_out - 2, dn4_out - 2, dn3_out, dn3_out };
	makeStraightTube(cp_f2, diams_f2, 7, 5, true);
	makeFlatRing(cp1_f2, vx, dn3_in, dn3_out, 10);

	double tubeParams[3] = { dn1_in, dn1_in, l1_bis };
	double interTubePosition[2] = { dn2_in / 2, 0 };
	double interTubeParameters[3] = { l2_bis, dn2_in, dn2_in };
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false, false, false };
	makeTubeToTubeIntersection(p1, vz, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	return 0;
}

short CGeneralBlockCreator::makePodejscie4()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real dn4_out; get_val("dn4_out", dn4_out);
	ads_real dn5_out; get_val("dn5_out", dn5_out);
	ads_real l1_lib; get_val("l1_lib", l1_lib);
	ads_real l2_lib; get_val("l2_lib", l2_lib);
	ads_real l1_bis; get_val("l1_bis", l1_bis);
	ads_real l2_bis; get_val("l2_bis", l2_bis);
	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);
	ads_real l4; get_val("l4", l4);
	ads_real l5; get_val("l5", l5);
	ads_real l6; get_val("l6", l6);
	ads_real l7; get_val("l7", l7);

	FdPoint3d p1(0, 0, 0), p2, p3;

	//top
	FdPoint3d cp1_t(0, 0, l1_bis), cp2_t(0, 0, l1_bis + l2), cp3_t(0, 0, l1_bis + l2 + l3),
		cp4_t(0, 0, l1_bis + l2 + l3 + l4), cp5_t(0,0,l1_bis + l2 + l3 + l4 + l5), cp6_t(0, 0, l1_bis + l2 + l3 + l4 + l5 + l6);
	FdPoint3d cp_t[] = { cp1_t, cp2_t, cp2_t, cp3_t, cp3_t, cp4_t, cp4_t, cp5_t, cp5_t, cp6_t, cp6_t };
	double diams_t[] = { dn1_out, dn1_out, dn1_out, dn1_out, dn5_out, dn5_out, dn1_out, dn1_out, dn1_out, dn1_out,};
	makeStraightTube(cp_t, diams_t, 11, 9, true);
	makeFlatRing(cp1_t, vz, dn1_in, dn1_out, 10);

	makeScrew(cp2_t, vz, vx, dn4_out, l3, true, true);
	makeScrew(cp4_t, vz, vx, dn4_out, l5, true, true);

	//bottom
	FdPoint3d cp1(0, 0, 0), cp2(0, 0, -l1);
	FdPoint3d cp[] = { cp1, cp2 };
	makeSimpleTube(cp1, cp2, dn1_out, dn1_out, 10);
	makeFlatRing(cp1, vz, dn1_in, dn1_out, 10);

	//front
	double h = l1_bis - dn2_in / 2;
	double p1_x = -l2_bis;
	double p2_x = p1_x - thick1;
	double p3_x = p2_x - l7;
	double p4_x = p3_x - thick2; 

	FdPoint3d cp1_f(p1_x, 0, h), cp2_f(p2_x, 0, h), cp3_f(p3_x, 0, h), cp4_f(p4_x, 0, h);
	FdPoint3d cp_f[] = { cp1_f, cp2_f, cp2_f, cp3_f, cp3_f, cp4_f, cp4_f };
	double diams_f[] = { dn2_out, dn2_out, dn3_out, dn3_out, dn2_out, dn2_out };
	makeStraightTube(cp_f, diams_f, 5, 3, true);
	makeFlatRing(cp1_f, vx, dn2_in, dn2_out, 10);

	double tubeParams[3] = { dn1_in, dn1_in, l1_bis };
	double interTubePosition[2] = { l1_bis - dn2_in / 2, 0 };
	double interTubeParameters[3] = { l2_bis, dn2_in, dn2_in};
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false, false, false };
	makeTubeToTubeIntersection(p1, vz, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	return 0;
}

short CGeneralBlockCreator::makePodejscie5()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real l1_lib; get_val("l1_lib", l1_lib);
	ads_real l2_lib; get_val("l2_lib", l2_lib);
	ads_real l1_bis; get_val("l1_bis", l1_bis);
	ads_real l2_bis; get_val("l2_bis", l2_bis);
	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);

	FdPoint3d p1(0, 0, 0), p2, p3;

	//top
	FdPoint3d cp1_t1(0, 0, l1_bis), cp2_t1(0, 0, l1_bis + l1);
	makeSimpleTube(cp1_t1, cp2_t1, dn1_out, dn1_out, 10);
	makeFlatRing(cp1_t1, vz, dn1_out, dn1_in, 10);

	//bottom
	FdPoint3d cp1(0, 0, 0), cp2(0, 0, -l2);
	makeSimpleTube(cp1, cp2, dn1_out, dn1_out, 10);
	makeFlatRing(cp1, vz, dn1_in, dn1_out, 10);

	//front
	double h = l1_bis / 2;
	double p1_x = -l2_bis;
	double p2_x = p1_x - thick1;
	double p3_x = p2_x - l3;
	double p4_x = p3_x - thick2;

	FdPoint3d cp1_f(p1_x, 0, h), cp2_f(p2_x, 0, h), cp3_f(p3_x, 0, h), cp4_f(p4_x, 0, h);
	FdPoint3d cp_f[] = { cp1_f, cp2_f, cp2_f, cp3_f, cp3_f, cp4_f, cp4_f };
	double diams_f[] = { dn2_out, dn2_out, dn3_out, dn3_out, dn2_out, dn2_out};
	makeStraightTube(cp_f, diams_f, 5, 3, true);
	makeFlatRing(cp1_f, vx, dn2_in, dn3_out, 10);

	//front2
	FdPoint3d cp0_f2(0, 0, h), cp1_f2(0, p1_x, h), cp2_f2(0, p2_x, h), cp3_f2(0, p3_x, h), cp4_f2(0, p4_x, h);
	FdPoint3d cp_f2[] = { cp0_f2, cp1_f2, cp1_f2, cp2_f2, cp2_f2, cp3_f2, cp3_f2, cp4_f2, cp4_f2 };
	double diams_f2[] = { dn2_in, dn2_in, dn2_out, dn2_out, dn3_out, dn3_out, dn2_out, dn2_out };
	makeStraightTube(cp_f2, diams_f2, 7, 7, true);

	double tubeParams[3] = { dn1_in, dn1_in, l1_bis};
	double interTubePosition[2] = { l1_bis / 2, 0 };
	double interTubeParameters[3] = { l2_bis, dn2_in, dn2_in};
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false, false, false };
	makeTubeToTubeIntersection(p1, vz, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	return 0;
}

short CGeneralBlockCreator::makePodejscie6()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real dn1_in; get_val("dn1_in", dn1_in);
	ads_real dn2_in; get_val("dn2_in", dn2_in);
	ads_real dn1_out; get_val("dn1_out", dn1_out);
	ads_real dn2_out; get_val("dn2_out", dn2_out);
	ads_real dn3_out; get_val("dn3_out", dn3_out);
	ads_real l1_lib; get_val("l1_lib", l1_lib);
	ads_real l2_lib; get_val("l2_lib", l2_lib);
	ads_real l1_bis; get_val("l1_bis", l1_bis);
	ads_real l2_bis; get_val("l2_bis", l2_bis);
	ads_real l1; get_val("l1", l1);
	ads_real l2; get_val("l2", l2);
	ads_real l3; get_val("l3", l3);

	FdPoint3d p1(0, 0, 0), p2, p3;

	//top
	FdPoint3d cp1_t1(0, 0, l1_bis), cp2_t1(0, 0, l1_bis + l1);
	FdPoint3d cp_tube_1[] = { cp1_t1, cp2_t1 };
	makeSimpleTube(cp1_t1, cp2_t1, dn1_out, dn1_out, 10);
	makeFlatRing(cp1_t1, vz, dn1_out, dn1_in, 10);

	//bottom
	FdPoint3d cp1(0, 0, 0), cp2(0, 0, -l2);
	FdPoint3d cp[] = { cp1, cp2, cp2 };
	makeSimpleTube(cp1, cp2, dn1_out, dn1_out, 10);
	makeFlatRing(cp1, vz, dn1_in, dn1_out, 10);

	//front
	double h = l1_bis / 2;
	double p1_x = -l2_bis;
	double p2_x = p1_x - thick1;
	double p3_x = p2_x - l3;
	double p4_x = p3_x - thick2;

	FdPoint3d cp1_f(p1_x, 0, h), cp2_f(p2_x, 0, h), cp3_f(p3_x, 0, h), cp4_f(p4_x, 0, h);
	FdPoint3d cp_f[] = { cp1_f, cp2_f, cp2_f, cp3_f, cp3_f, cp4_f, cp4_f };
	double diams_f[] = { dn2_out, dn2_out, dn3_out, dn3_out, dn2_out, dn2_out};
	makeStraightTube(cp_f, diams_f, 5, 3, true);
	makeFlatRing(cp1_f, vx, dn2_in, dn2_out, 10);

	double tubeParams[3] = { dn1_in, dn1_in, l1_bis};
	double interTubePosition[2] = { l1_bis / 2, 0 };
	double interTubeParameters[3] = { dn2_out, dn3_out, dn3_out};
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false, false, false };
	makeTubeToTubeIntersection(p1, vz, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	return 0;
}

short CGeneralBlockCreator::makeMijanka1()
{
	double thick1 = 3.5;
	double thick2 = 0.8;

	ads_real t1_dn1_in; get_val("t1_dn1_in", t1_dn1_in);
	ads_real t1_dn2_in; get_val("t1_dn2_in", t1_dn2_in);
	ads_real t1_l1_bis; get_val("t1_l1_bis", t1_l1_bis);
	ads_real t1_l2_bis; get_val("t1_l2_bis", t1_l2_bis);
	ads_real t_dist1; get_val("t_dist1", t_dist1);
	ads_real t_dist2; get_val("t_dist2", t_dist2);
	ads_real t2_dn1_in; get_val("t2_dn1_in", t2_dn1_in);
	ads_real t2_dn2_in; get_val("t2_dn2_in", t2_dn2_in);
	ads_real t2_l1_bis; get_val("t2_l1_bis", t2_l1_bis);
	ads_real t2_l2_bis; get_val("t2_l2_bis", t2_l2_bis);
	ads_real tube_l; get_val("tube_l", tube_l);
	ads_real tr_d1; get_val("tr_d1", tr_d1); ads_real tt_d1; get_val("tt_d1", tt_d1); ads_real tl_d1; get_val("tl_d1", tl_d1);
	ads_real tr_d2; get_val("tr_d2", tr_d2); ads_real tt_d2; get_val("tt_d2", tt_d2); ads_real tl_d2; get_val("tl_d2", tl_d2);


	FdPoint3d p1(0, 0, 0), p2(0, t1_dn1_in + t_dist2, 0);

	double tubeParams[3] = { t1_dn1_in, t1_dn1_in, t1_l1_bis };
	double interTubePosition[2] = { t1_l1_bis - t_dist1 - t1_dn2_in / 2, 0 };
	double interTubeParameters[3] = { t1_l2_bis, t1_dn2_in, t1_dn2_in };
	double angles[3] = { 90 ,90,90 };
	int n[2] = { 10, 10 };
	bool opt[3] = { false,false,false };
	makeTubeToTubeIntersection(p1, -vx, tubeParams, interTubePosition, interTubeParameters, angles, n, opt);

	double tubeParams2[3] = { t2_dn1_in, t2_dn1_in, t2_l1_bis };
	double interTubePosition2[2] = { t2_l1_bis - t_dist1 - t2_dn2_in / 2, 0 };
	double interTubeParameters2[3] = { t2_l2_bis, t2_dn2_in, t2_dn2_in };
	makeTubeToTubeIntersection(p2, -vx, tubeParams2, interTubePosition2, interTubeParameters2, angles, n, opt);
	
	double diams_r[] = { tr_d2, tr_d2, tr_d1, tr_d1, tr_d2, tr_d2 };
	double diams_t[] = { tt_d2, tt_d2, tt_d1, tt_d1, tt_d2, tt_d2 };
	double diams_l[] = { tl_d2, tl_d2, tl_d1, tl_d1, tl_d2, tl_d2 };

	FdPoint3d cp_r1_1(0, 0, 0), cp_r1_2(thick1, 0, 0), cp_r1_3(thick1 + tube_l, 0, 0), cp_r1_4(thick1 + tube_l + thick2, 0, 0);
	FdPoint3d cp_r1[] = { cp_r1_1, cp_r1_2, cp_r1_2, cp_r1_3, cp_r1_3, cp_r1_4, cp_r1_4 };

	FdPoint3d cp_r2_1(0, t1_dn1_in + t_dist2, 0), cp_r2_2(thick1, t1_dn1_in + t_dist2, 0), cp_r2_3(thick1 + tube_l, t1_dn1_in + t_dist2, 0), cp_r2_4(thick1 + tube_l + thick2, t1_dn1_in + t_dist2, 0);
	FdPoint3d cp_r2[] = { cp_r2_1, cp_r2_2, cp_r2_2, cp_r2_3, cp_r2_3, cp_r2_4, cp_r2_4 };

	FdPoint3d cp_t1_1(-t1_l1_bis + t_dist1 + t1_dn2_in / 2, t1_l2_bis, 0), cp_t1_2(-t1_l1_bis + t_dist1 + t1_dn2_in / 2, t1_l2_bis + thick1, 0),
		cp_t1_3(-t1_l1_bis + t_dist1 + t1_dn2_in / 2, t1_l2_bis + thick1 + tube_l, 0), cp_t1_4(-t1_l1_bis + t_dist1 + t1_dn2_in / 2, t1_l2_bis + thick1 + tube_l + thick2, 0);
	FdPoint3d cp_t1[] = { cp_t1_1, cp_t1_2, cp_t1_2, cp_t1_3, cp_t1_3, cp_t1_4, cp_t1_4 };

	FdPoint3d cp_t2_1(-t2_l1_bis + t_dist1 + t2_dn2_in / 2, t1_l2_bis, 0), cp_t2_2(-t2_l1_bis + t_dist1 + t2_dn2_in / 2, t1_l2_bis + thick1, 0),
		cp_t2_3(-t2_l1_bis + t_dist1 + t2_dn2_in / 2, t1_l2_bis + thick1 + tube_l, 0), cp_t2_4(-t2_l1_bis + t_dist1 + t2_dn2_in / 2, t1_l2_bis + thick1 + tube_l + thick2, 0);
	FdPoint3d cp_t2[] = { cp_t2_1, cp_t2_2, cp_t2_2, cp_t2_3, cp_t2_3, cp_t2_4, cp_t2_4 };

	FdPoint3d cp_l1_1(-t1_l1_bis, 0, 0), cp_l1_2(-t1_l1_bis - thick1, 0, 0), cp_l1_3(-t1_l1_bis - thick1 - tube_l, 0, 0), cp_l1_4(-t1_l1_bis - thick1 - tube_l - thick2, 0, 0);
	FdPoint3d cp_l1[] = { cp_l1_1, cp_l1_2, cp_l1_2, cp_l1_3, cp_l1_3, cp_l1_4, cp_l1_4 };

	FdPoint3d cp_l2_1(-t2_l1_bis, t1_dn1_in + t_dist2, 0), cp_l2_2(-t2_l1_bis - thick1, t1_dn1_in + t_dist2, 0),
		cp_l2_3(-t2_l1_bis - thick1 - tube_l, t1_dn1_in + t_dist2, 0), cp_l2_4(-t2_l1_bis - thick1 - tube_l - thick2, t1_dn1_in + t_dist2, 0);
	FdPoint3d cp_l2[] = { cp_l2_1, cp_l2_2, cp_l2_2, cp_l2_3, cp_l2_3, cp_l2_4, cp_l2_4 };
	
	makeStraightTube(cp_r1, diams_r, 7, 5, true); // right down
	makeStraightTube(cp_r2, diams_r, 7, 5, true); // right up
	makeStraightTube(cp_t1, diams_t, 7, 5, true); // top right
	makeStraightTube(cp_t2, diams_t, 7, 5, true); // top left
	makeStraightTube(cp_l1, diams_l, 7, 5, true); // left down
	makeStraightTube(cp_l2, diams_l, 7, 5, true); // left up

	makeFlatRing(cp_r1_1, vx, tr_d2, t1_dn1_in, 10);
	makeFlatRing(cp_r2_1, vx, tr_d2, t2_dn1_in, 10);
	makeFlatRing(cp_t1_1, vy, tt_d2, t1_dn2_in, 10);
	makeFlatRing(cp_t2_1, vy, tt_d2, t2_dn2_in, 10);
	makeFlatRing(cp_l1_1, vx, tl_d2, t1_dn1_in, 10);
	makeFlatRing(cp_l2_1, vx, tl_d2, t2_dn1_in, 10);

	return 0;
}

short CGeneralBlockCreator :: makeMijanka2()
	{
	double alfa = 45;
	double r = 0.5 * 16;
	double diams_1[] = { 16, 16 };
	double diams_2[] = { 16, 16 };

	// FdPoint3d p(100, 0, 16);
	FdPoint3d p(100, 0, 16);
	FdPoint3d p2(200, 0, 16);
	FdPoint3d p3(150, 0, 16);

	int n = 20;
	int seg = 1;

	makeDonutSection(p,  -vy, -vz, r * 2, 16, alfa, n, n);
	makeDonutSection(p2,  vy, -vz, r * 2, 16, alfa, n, n);
	makeDonutSection(p3, -vy,  vz, r * 2, 16, alfa, n, n);
	makeDonutSection(p3,  vy,  vz, r * 2, 16, alfa, n, n);

	double alfa2 = alfa * ARX_PI / 180;
	p.set(100 + r, 0, r / 2);

	FdPoint3d cp1_i1(100 + 2 * r + 100 / 5, 0, r / 2), cp2_i1(400, 0, 0);
	FdPoint3d Inner1[] = { p.rotateBy(45, vy), cp1_i1.rotateBy(0, vy) };

	makeStraightTube(Inner1, diams_1, n, seg, true);

	// tubes
	// tube left
	FdPoint3d cp1_l(0, 0, 0), cp2_l(100, 0, 0);
	makeSimpleTube(cp1_l, cp2_l, 16, 16, 10);

	// tube right
	FdPoint3d cp1_r(200, 0, 0), cp2_r(300, 0, 0);
	makeSimpleTube(cp1_r, cp2_r, 16, 16, 10);

	// tube top
	// FdPoint3d cp1_t(...), cp2_t(...);
	// makeSimpleTube(cp1_t, cp2_t, 16, 16, 10);

	return 0;
	}
short CGeneralBlockCreator::makeB_MainHold()
{

	double D1 = 210, D2 = 50, G1 = 33, G4 = 20, G5 = 15, G6 = 15, numOfWays = 12;
	get_val("L", D1);
	get_val("W", D2);
	get_val("d", G4);
	get_val("D", G1);
	get_val("n", numOfWays);
	G5 = G6 = 0.75 * G4;
	double L = numOfWays * D2 + 50;
	FdVector3d vUp(vz), vN(vx);
	FdVector3d vCr = vUp.crossProduct(vN);
	FdPoint3d p0 = FdPoint3d(0, 0, 0);
	FdPoint3d p1, p2;

	p1 = p0;
	p1 += vCr * D1 * 0.5;
	p1 -= vN * 0.5 * L;
	p2 = p1;
	p2 += vN * L;

	FdPoint3d fullPoints[6] = { p1, p1, p2, p2 };
	FdVector3d normalVectors[6] = { vN,vN,vN,vN };
	FdVector3d upVectors[6] = { vUp,vUp,vUp,vUp };
	fullPoints[1] += vN * 0.02 * L;
	fullPoints[2] -= vN * 0.02 * L;
	double tabHeights[6] = { G1,G1 * 1.5, G1 * 1.5, G1 };
	double tabWidths[6] = { G4,G4,G4,G4 };
	bool sides[24] = { true,true,true,true,true,true,true,true,true,true,true,true,
						true,true,true,true,true,true,true,true,true,true,true,true };
	for (int i = 0; i < 2; i++) {
		for (auto& point : fullPoints)
			point.rotateBy(M_PI, vN, p0);
		makeBox(3, fullPoints, normalVectors, upVectors, tabHeights, tabWidths, sides, true, true, 0, 0, 0);
	}

	//1 - S
	makeVerySimpleTube(p1, p2, G1, cpx);
	makeFlatDisc(p1, vN, G1, cpx);
	makeFlatDisc(p2, vN, G1, cpx);


	p2 = p1;
	p2 -= vN * 1;
	makeVerySimpleTube(p1, p2, G1, cpx);
	makeFlatDisc(p2, vN, G1, cpx);

	p2 -= vN * 5;
	p1.rotateBy(M_PI, vN, p0);
	p2.rotateBy(M_PI, vN, p0);
	makeFacettedCylinder(p1, p2, vCr, G1, 0, 360, 6, true, true);

	p1 += vN * 25;
	p1 += vCr * G1 * 0.75;
	p2 = p1;
	p2 += vCr * 5;
	makeFacettedCylinder(p1, p2, vN, G5 * 1.15, 0, 360, 6, true, true);

	FdPoint3d p3 = p2;
	p3 += vCr * 5;
	makeVerySimpleTube(p2, p3, G5, cpx);
	makeFlatDisc(p3, vCr, G5, cpx);

	p1 -= vCr * G1 * 1.5;
	p2 = p1;
	p2 -= vCr * 6;
	makeFacettedCylinder(p1, p2, vN, G6 * 1.2, 0, 360, 6, true, true);

	p3 = p2;
	p3 -= vCr * 20;
	makeVerySimpleTube(p2, p3, G6, cpx);

	p2 = p3;
	p3 -= vCr * 3;
	makeSimpleTube(p2, p3, G6, G6 * 0.8, cpx);
	makeFlatDisc(p3, vCr, G6 * 0.8, cpx);

	p2 += vCr * 15;
	p3 = p2;
	p3 -= vN * 25;
	p3.rotateBy(M_PI * 0.15, vUp, p2);
	FdVector3d nV = vN;
	nV.rotateBy(M_PI * 0.15, vUp);
	makeVerySimpleTube(p2, p3, G6 * 0.5, cpx);
	makeFlatDisc(p3, nV, G6 * 0.5, cpx);

	p3 = p2;
	p3 -= vN * 17;
	p3.rotateBy(M_PI * 0.15, vUp, p2);

	FdPoint3d p4 = p2;
	p4 -= vN * 22;
	p4.rotateBy(M_PI * 0.15, vUp, p2);
	nV.rotateBy(M_PI * 0.5, vUp);
	makeFacettedCylinder(p3, p4, nV, G6 * 1.5, 0, 360, 12, true, true);


	p1 += vN * D2;
	for (int i = 0; i < numOfWays; i++) {
		p2 = p1;
		p2 -= vCr * 3;
		makeFacettedCylinder(p1, p2, vN, G4, 0, 360, 6, true, true);

		p3 = p2;
		p3 -= vCr * 2;
		makeVerySimpleTube(p2, p3, G4 * 0.9, cpx);

		p2 = p3;
		p3 -= vCr * 5;
		makeVerySimpleTube(p2, p3, G4, cpx);
		makeFlatDisc(p2, vCr, G4, cpx);
		makeFlatDisc(p3, vCr, G4, cpx);
		p1 += vN * D2;
	}

	p1 = p0;
	p1 += vCr * (D1 * 0.5 + 0.75 * G1);
	p1 -= vN * 0.5 * L;
	p1 += vN * D2 * 1.5;
	for (int i = 0; i < numOfWays; i++) {
		p2 = p1;
		p2 += vCr * 4;
		makeFacettedCylinder(p1, p2, vN, G4, 0, 360, 6, true, true);

		p3 = p2;
		p3 += vCr * 2;
		makeFlatDisc(p2, vCr, G4 / 1.1, cpx);
		makeVerySimpleTube(p2, p3, G4 / 1.1, cpx);
		makeFlatDisc(p3, vCr, G4 / 1.1, cpx);

		p2 = p3;
		p3 += vCr * 2;
		makeFacettedCylinder(p2, p3, vN, G4, 0, 360, 6, true, true);

		p2 = p3;
		p3 += vCr * 1;
		makeFlatDisc(p2, vCr, G4 / 1.1, cpx);
		makeVerySimpleTube(p2, p3, G4 / 1.1, cpx);
		makeFlatDisc(p3, vCr, G4 / 1.1, cpx);

		p1 += vN * D2;
	}

	//1 - E

	//2 - S
	p1 = p0;
	p1 -= vCr * D1 * 0.5;
	p1 -= vN * 0.5 * L;
	p2 = p1;
	p2 += vN * L;
	makeVerySimpleTube(p1, p2, G1, cpx);
	makeFlatDisc(p1, vN, G1, cpx);
	makeFlatDisc(p2, vN, G1, cpx);


	p2 = p1;
	p2 -= vN * 1;
	makeVerySimpleTube(p1, p2, G1, cpx);
	makeFlatDisc(p2, vN, G1, cpx);

	p2 -= vN * 5;
	p1.rotateBy(M_PI, vN, p0);
	p2.rotateBy(M_PI, vN, p0);
	makeFacettedCylinder(p1, p2, vCr, G1, 0, 360, 6, true, true);

	p1 += vN * 25;
	p1 += vCr * G1 * 0.75;
	p2 = p1;
	p2 += vCr * 5;
	makeFacettedCylinder(p1, p2, vN, G5 * 1.15, 0, 360, 6, true, true);

	p3 = p2;
	p3 += vCr * 5;
	makeVerySimpleTube(p2, p3, G5, cpx);
	makeFlatDisc(p3, vCr, G5, cpx);

	p1 -= vCr * G1 * 1.5;
	p2 = p1;
	p2 -= vCr * 6;
	makeFacettedCylinder(p1, p2, vN, G6 * 1.2, 0, 360, 6, true, true);

	p3 = p2;
	p3 -= vCr * 20;
	makeVerySimpleTube(p2, p3, G6, cpx);

	p2 = p3;
	p3 -= vCr * 3;
	makeSimpleTube(p2, p3, G6, G6 * 0.8, cpx);
	makeFlatDisc(p3, vCr, G6 * 0.8, cpx);

	p2 += vCr * 15;
	p3 = p2;
	p3 -= vN * 25;
	p3.rotateBy(M_PI * 0.15, vUp, p2);
	nV = vN;
	nV.rotateBy(M_PI * 0.15, vUp);
	makeVerySimpleTube(p2, p3, G6 * 0.5, cpx);
	makeFlatDisc(p3, nV, G6 * 0.5, cpx);

	p3 = p2;
	p3 -= vN * 17;
	p3.rotateBy(M_PI * 0.15, vUp, p2);

	p4 = p2;
	p4 -= vN * 22;
	p4.rotateBy(M_PI * 0.15, vUp, p2);
	nV.rotateBy(M_PI * 0.5, vUp);
	makeFacettedCylinder(p3, p4, nV, G6 * 1.5, 0, 360, 12, true, true);


	p1 += vN * D2;
	for (int i = 0; i < numOfWays; i++) {
		p2 = p1;
		p2 -= vCr * 3;
		makeFacettedCylinder(p1, p2, vN, G4, 0, 360, 6, true, true);

		p3 = p2;
		p3 -= vCr * 2;
		makeVerySimpleTube(p2, p3, G4 * 0.9, cpx);

		p2 = p3;
		p3 -= vCr * 5;
		makeVerySimpleTube(p2, p3, G4, cpx);
		makeFlatDisc(p2, vCr, G4, cpx);
		makeFlatDisc(p3, vCr, G4, cpx);
		p1 += vN * D2;
	}

	p1 = p0;
	p1 -= vCr * (D1 * 0.5 - 0.75 * G1);
	p1 -= vN * 0.5 * L;
	p1 += vN * D2 * 1.5;
	for (int i = 0; i < numOfWays; i++) {
		p2 = p1;
		p2 += vCr * 4;
		makeFacettedCylinder(p1, p2, vN, G4, 0, 360, 6, true, true);

		p3 = p2;
		p3 += vCr * 2;
		makeFlatDisc(p2, vCr, G4 / 1.1, cpx);
		makeVerySimpleTube(p2, p3, G4 / 1.1, cpx);
		makeFlatDisc(p3, vCr, G4 / 1.1, cpx);

		p2 = p3;
		p3 += vCr * 2;
		makeFacettedCylinder(p2, p3, vN, G4, 0, 360, 6, true, true);

		p2 = p3;
		p3 += vCr * 1;
		makeFlatDisc(p2, vCr, G4 / 1.1, cpx);
		makeVerySimpleTube(p2, p3, G4 / 1.1, cpx);
		makeFlatDisc(p3, vCr, G4 / 1.1, cpx);

		p1 += vN * D2;
	}
	//2 - E

	//Connector - S
	p1 = p2 = p0;
	p1 -= vCr * D1 * 0.5;
	p2 += vCr * D1 * 0.5;
	p1 -= vN * (0.5 * L - D2);
	p2 -= vN * (0.5 * L - D2);
	p1 -= vUp * (0.5 * G1 + 1);
	p2 -= vUp * (0.5 * G1 + 1);

	fullPoints[0] = fullPoints[1] = fullPoints[2] = p1;
	fullPoints[0] -= vCr * G1;
	fullPoints[1] += vCr * G1;
	fullPoints[2] += vCr * G1 * 1.25;
	fullPoints[2] -= vUp * G1 * 0.5;
	fullPoints[3] = fullPoints[4] = fullPoints[5] = p2;
	fullPoints[5] += vCr * G1;
	fullPoints[4] -= vCr * G1;
	fullPoints[3] -= vCr * G1 * 1.25;
	fullPoints[3] -= vUp * G1 * 0.5;
	normalVectors[0] = normalVectors[1] = normalVectors[2] = normalVectors[3] = normalVectors[4] = normalVectors[5] = vCr;
	upVectors[0] = upVectors[1] = upVectors[2] = upVectors[3] = upVectors[4] = upVectors[5] = vN;
	tabHeights[0] = tabHeights[1] = tabHeights[2] = tabHeights[3] = tabHeights[4] = tabHeights[5] = G1 * 0.4;
	tabWidths[0] = tabWidths[1] = tabWidths[2] = tabWidths[3] = tabWidths[4] = tabWidths[5] = 2;
	for (int i = 0; i < 2; i++) {
		for (auto& point : fullPoints)
			point.rotateBy(M_PI, vUp, p0);
		makeBox(5, fullPoints, normalVectors, upVectors, tabWidths, tabHeights, sides, true, true, 0, 0, 0);
	}


	//Connector - E
	return 0;
}
short CGeneralBlockCreator::makePlateExchanger_V2()
{
	double A, B, C, D, E, F, n = 20, d1, d2;
	get_val("A", A);
	get_val("B", B);
	get_val("C", C);
	get_val("D", D);
	get_val("E", E);
	get_val("F", F);
	get_val("n", n);
	get_val("d1", d1);
	get_val("d2", d2);
	E = 11 + E * n;
	char* con_t;
	get_val("con_type", con_t);
	double roundedRadius = 0.1 * A;
	FdVector3d vUp(vz), vN(vx);
	FdVector3d vCr = vUp.crossProduct(vN);
	FdPoint3d p0 = FdPoint3d(0, 0, 0);
	FdPoint3d p1, p2;

	FdPoint3d points[2] = { p0, p0 };
	points[0] -= vCr * 0.5 * E;
	points[1] += vCr * 0.5 * E;
	FdVector3d normalVectors[2] = { vCr,vCr };
	FdVector3d upVectors[2] = { vN,vN };
	bool sides[4] = { true,true,true,true };
	double tabHeights[2] = { A,A };
	double tabWidths[2] = { B - roundedRadius,B - roundedRadius };
	makeBox(1, points, normalVectors, upVectors, tabHeights, tabWidths, sides, true, true, 0, 0, 0);

	tabHeights[0] = tabHeights[1] = A - roundedRadius;
	tabWidths[0] = tabWidths[1] = B;
	makeBox(1, points, normalVectors, upVectors, tabHeights, tabWidths, sides, true, true, 0, 0, 0);


	p1 = points[0];
	p1 += vUp * 0.5 * (A - roundedRadius);
	p1 -= vN * 0.5 * (B - roundedRadius);
	p2 = p1;
	p2 += vCr * E;
	for (int i = 0; i < 2; i++) {
		p1.rotateBy(M_PI, vCr, p0);
		p2.rotateBy(M_PI, vCr, p0);
		makeVerySimpleTube(p1, p2, roundedRadius, cpx);
		makeFlatDisc(p1, vCr, roundedRadius, cpx);
		makeFlatDisc(p2, vCr, roundedRadius, cpx);
	}

	p1 += vN * (B - roundedRadius);
	p2 = p1;
	p2 += vCr * E;
	for (int i = 0; i < 2; i++) {
		p1.rotateBy(M_PI, vCr, p0);
		p2.rotateBy(M_PI, vCr, p0);
		makeVerySimpleTube(p1, p2, roundedRadius, cpx);
		makeFlatDisc(p1, vCr, roundedRadius, cpx);
		makeFlatDisc(p2, vCr, roundedRadius, cpx);
	}

	if (strcmp(con_t, "Non-flange") == 0) {
		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 += vN * 0.5 * D;
		p1 += vUp * 0.5 * C;
		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d2, cpx);
		makeVerySimpleTube(p1, p2, d2 * 0.9, cpx);
		makeFlatRing(p2, vCr, d2 * 0.9, d2, cpx);

		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 += vN * 0.5 * D;
		p1 -= vUp * 0.5 * C;
		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d2, cpx);
		makeVerySimpleTube(p1, p2, d2 * 0.9, cpx);
		makeFlatRing(p2, vCr, d2 * 0.9, d2, cpx);

		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 -= vN * 0.5 * D;
		p1 += vUp * 0.5 * C;
		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d1, cpx);
		makeVerySimpleTube(p1, p2, d1 * 0.9, cpx);
		makeFlatRing(p2, vCr, d1 * 0.9, d1, cpx);

		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 -= vN * 0.5 * D;
		p1 -= vUp * 0.5 * C;
		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d1, cpx);
		makeVerySimpleTube(p1, p2, d1 * 0.9, cpx);
		makeFlatRing(p2, vCr, d1 * 0.9, d1, cpx);

	}
	else if (strcmp(con_t, "Non-flange(6 gates)") == 0) {
		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 += vN * 0.5 * D;
		p1 += vUp * 0.5 * C;
		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d2, cpx);
		makeVerySimpleTube(p1, p2, d2 * 0.9, cpx);
		makeFlatRing(p2, vCr, d2 * 0.9, d2, cpx);

		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 += vN * 0.5 * D;
		p1 -= vUp * 0.5 * C;
		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d2, cpx);
		makeVerySimpleTube(p1, p2, d2 * 0.9, cpx);
		makeFlatRing(p2, vCr, d2 * 0.9, d2, cpx);

		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 -= vN * 0.5 * D;
		p1 += vUp * 0.5 * C;
		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d1, cpx);
		makeVerySimpleTube(p1, p2, d1 * 0.9, cpx);
		makeFlatRing(p2, vCr, d1 * 0.9, d1, cpx);

		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 -= vN * 0.5 * D;
		p1 -= vUp * 0.5 * C;
		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d1, cpx);
		makeVerySimpleTube(p1, p2, d1 * 0.9, cpx);
		makeFlatRing(p2, vCr, d1 * 0.9, d1, cpx);

		p1 = p0;
		p1 += vCr * 0.5 * E;
		p1 -= vN * 0.5 * D;
		p1 += vUp * 0.5 * C;
		p2 = p1;
		p2 += vCr * F;
		makeVerySimpleTube(p1, p2, d1, cpx);
		makeVerySimpleTube(p1, p2, d1 * 0.9, cpx);
		makeFlatRing(p2, vCr, d1 * 0.9, d1, cpx);

		p1 = p0;
		p1 += vCr * 0.5 * E;
		p1 += vN * 0.5 * D;
		p1 += vUp * 0.5 * C;
		p2 = p1;
		p2 += vCr * F;
		makeVerySimpleTube(p1, p2, d2, cpx);
		makeVerySimpleTube(p1, p2, d2 * 0.9, cpx);
		makeFlatRing(p2, vCr, d2 * 0.9, d2, cpx);

	}
	else if (strcmp(con_t, "Flange(4 hole)") == 0) {
		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 += vN * 0.5 * D;
		p1 += vUp * 0.5 * C;

		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d2 * 57.0 / 165.0, cpx);

		p1 = p2;
		p2 += vCr * 3;
		makeSimpleTube(p1, p2, d2 * 102.0 / 165.0, d2 * 110.0 / 165.0, cpx);
		makeFlatRing(p1, vCr, d2 * 57.0 / 165.0, d2 * 102.0 / 165.0, cpx);
		makeFlatRing(p2, vCr, d2 * 110.0 / 165.0, d2, cpx);

		p1 = p2;
		p2 += vCr * 17;
		makeVerySimpleTube(p1, p2, d2, cpx);
		makeFlatRing(p2, vCr, d2 * 57.0 / 165.0, d2, cpx);

		points[0] = p1;
		points[1] = p2;
		points[0] += vUp * 62.5 * d2 / 165;
		points[1] += vUp * 62.5 * d2 / 165;

		points[0].rotateBy(M_PI * 0.25, vCr, p1);
		points[1].rotateBy(M_PI * 0.25, vCr, p1);

		for (int i = 0; i < 4; i++) {
			points[0].rotateBy(M_PI * 0.5, vCr, p1);
			points[1].rotateBy(M_PI * 0.5, vCr, p1);
			makeSymbolicCircle(points[0], vCr, d2 * 18.0 / 165.0);
			makeSymbolicCircle(points[1], vCr, d2 * 18.0 / 165.0);
		}


		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 -= vN * 0.5 * D;
		p1 += vUp * 0.5 * C;

		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d1 * 57.0 / 165.0, cpx);

		p1 = p2;
		p2 += vCr * 3;
		makeSimpleTube(p1, p2, d1 * 102.0 / 165.0, d1 * 110.0 / 165.0, cpx);
		makeFlatRing(p1, vCr, d1 * 57.0 / 165.0, d1 * 102.0 / 165.0, cpx);
		makeFlatRing(p2, vCr, d1 * 110.0 / 165.0, d1, cpx);

		p1 = p2;
		p2 += vCr * 17;
		makeVerySimpleTube(p1, p2, d1, cpx);
		makeFlatRing(p2, vCr, d1 * 57.0 / 165.0, d1, cpx);

		points[0] = p1;
		points[1] = p2;
		points[0] += vUp * (62.5 * d1 / 165.0);
		points[1] += vUp * (62.5 * d1 / 165.0);

		points[0].rotateBy(M_PI * 0.25, vCr, p1);
		points[1].rotateBy(M_PI * 0.25, vCr, p1);

		for (int i = 0; i < 4; i++) {
			points[0].rotateBy(M_PI * 0.5, vCr, p1);
			points[1].rotateBy(M_PI * 0.5, vCr, p1);
			makeSymbolicCircle(points[0], vCr, d1 * 18.0 / 165.0);
			makeSymbolicCircle(points[1], vCr, d1 * 18.0 / 165.0);
		}

		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 += vN * 0.5 * D;
		p1 -= vUp * 0.5 * C;

		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d2 * 57.0 / 165.0, cpx);

		p1 = p2;
		p2 += vCr * 3;
		makeSimpleTube(p1, p2, d2 * 102.0 / 165.0, d2 * 110.0 / 165.0, cpx);
		makeFlatRing(p1, vCr, d2 * 57.0 / 165.0, d2 * 102.0 / 165.0, cpx);
		makeFlatRing(p2, vCr, d2 * 110.0 / 165.0, d2, cpx);

		p1 = p2;
		p2 += vCr * 17;
		makeVerySimpleTube(p1, p2, d2, cpx);
		makeFlatRing(p2, vCr, d2 * 57.0 / 165.0, d2, cpx);

		points[0] = p1;
		points[1] = p2;
		points[0] += vUp * 62.5 * d2 / 165;
		points[1] += vUp * 62.5 * d2 / 165;

		for (int i = 0; i < 4; i++) {
			points[0].rotateBy(M_PI * 0.5, vCr, p1);
			points[1].rotateBy(M_PI * 0.5, vCr, p1);
			makeSymbolicCircle(points[0], vCr, d2 * 18.0 / 165.0);
			makeSymbolicCircle(points[1], vCr, d2 * 18.0 / 165.0);
		}


		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 -= vN * 0.5 * D;
		p1 -= vUp * 0.5 * C;

		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d1 * 57.0 / 165.0, cpx);

		p1 = p2;
		p2 += vCr * 3;
		makeSimpleTube(p1, p2, d1 * 102.0 / 165.0, d1 * 110.0 / 165.0, cpx);
		makeFlatRing(p1, vCr, d1 * 57.0 / 165.0, d1 * 102.0 / 165.0, cpx);
		makeFlatRing(p2, vCr, d1 * 110.0 / 165.0, d1, cpx);

		p1 = p2;
		p2 += vCr * 17;
		makeVerySimpleTube(p1, p2, d1, cpx);
		makeFlatRing(p2, vCr, d1 * 57.0 / 165.0, d1, cpx);

		points[0] = p1;
		points[1] = p2;
		points[0] += vUp * (62.5 * d1 / 165.0);
		points[1] += vUp * (62.5 * d1 / 165.0);

		points[0].rotateBy(M_PI * 0.25, vCr, p1);
		points[1].rotateBy(M_PI * 0.25, vCr, p1);

		for (int i = 0; i < 4; i++) {
			points[0].rotateBy(M_PI * 0.5, vCr, p1);
			points[1].rotateBy(M_PI * 0.5, vCr, p1);
			makeSymbolicCircle(points[0], vCr, d1 * 18.0 / 165.0);
			makeSymbolicCircle(points[1], vCr, d1 * 18.0 / 165.0);
		}
	}
	else if (strcmp(con_t, "Flange(8 hole)") == 0) {
		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 += vN * 0.5 * D;
		p1 += vUp * 0.5 * C;

		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d2 * 108.0 / 220.0, cpx);

		p1 = p2;
		p2 += vCr * 3;
		makeSimpleTube(p1, p2, d2 * 158.0 / 220.0, d2 * 170.0 / 220.0, cpx);
		makeFlatRing(p1, vCr, d2 * 108.0 / 220.0, d2 * 158.0 / 220.0, cpx);
		makeFlatRing(p2, vCr, d2 * 170.0 / 220.0, d2, cpx);

		p1 = p2;
		p2 += vCr * 17;
		makeVerySimpleTube(p1, p2, d2, cpx);
		makeFlatRing(p2, vCr, d2 * 108.0 / 220.0, d2, cpx);

		points[0] = p1;
		points[1] = p2;
		points[0] += vUp * (d2 * 90.0 / 220.0);
		points[1] += vUp * (d2 * 90.0 / 220.0);

		for (int i = 0; i < 8; i++) {
			points[0].rotateBy(M_PI * 0.25, vCr, p1);
			points[1].rotateBy(M_PI * 0.25, vCr, p1);
			makeSymbolicCircle(points[0], vCr, d2 * 18.0 / 220.0);
			makeSymbolicCircle(points[1], vCr, d2 * 18.0 / 220.0);
		}

		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 -= vN * 0.5 * D;
		p1 += vUp * 0.5 * C;

		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d1 * 57.0 / 185.0, cpx);

		p1 = p2;
		p2 += vCr * 3;
		makeSimpleTube(p1, p2, d1 * 122.0 / 185.0, d1 * 130.0 / 185.0, cpx);
		makeFlatRing(p1, vCr, d1 * 57.0 / 185.0, d1 * 122.0 / 185.0, cpx);
		makeFlatRing(p2, vCr, d1 * 130.0 / 185.0, d1, cpx);

		p1 = p2;
		p2 += vCr * 17;
		makeVerySimpleTube(p1, p2, d1, cpx);
		makeFlatRing(p2, vCr, d1 * 57.0 / 185.0, d1, cpx);

		points[0] = p1;
		points[1] = p2;
		points[0] += vUp * (d1 * 72.5 / 185.0);
		points[1] += vUp * (d1 * 72.5 / 185.0);

		points[0].rotateBy(M_PI * 0.25, vCr, p1);
		points[1].rotateBy(M_PI * 0.25, vCr, p1);

		for (int i = 0; i < 4; i++) {
			points[0].rotateBy(M_PI * 0.5, vCr, p1);
			points[1].rotateBy(M_PI * 0.5, vCr, p1);
			makeSymbolicCircle(points[0], vCr, d1 * 18.0 / 185.0);
			makeSymbolicCircle(points[1], vCr, d1 * 18.0 / 185.0);
		}

		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 += vN * 0.5 * D;
		p1 -= vUp * 0.5 * C;

		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d2 * 108.0 / 220.0, cpx);

		p1 = p2;
		p2 += vCr * 3;
		makeSimpleTube(p1, p2, d2 * 158.0 / 220.0, d2 * 170.0 / 220.0, cpx);
		makeFlatRing(p1, vCr, d2 * 108.0 / 220.0, d2 * 158.0 / 220.0, cpx);
		makeFlatRing(p2, vCr, d2 * 170.0 / 220.0, d2, cpx);

		p1 = p2;
		p2 += vCr * 17;
		makeVerySimpleTube(p1, p2, d2, cpx);
		makeFlatRing(p2, vCr, d2 * 108.0 / 220.0, d2, cpx);

		points[0] = p1;
		points[1] = p2;
		points[0] += vUp * (d2 * 90.0 / 220.0);
		points[1] += vUp * (d2 * 90.0 / 220.0);

		for (int i = 0; i < 8; i++) {
			points[0].rotateBy(M_PI * 0.25, vCr, p1);
			points[1].rotateBy(M_PI * 0.25, vCr, p1);
			makeSymbolicCircle(points[0], vCr, d2 * 18.0 / 220.0);
			makeSymbolicCircle(points[1], vCr, d2 * 18.0 / 220.0);
		}

		p1 = p0;
		p1 -= vCr * 0.5 * E;
		p1 -= vN * 0.5 * D;
		p1 -= vUp * 0.5 * C;

		p2 = p1;
		p2 -= vCr * F;
		makeVerySimpleTube(p1, p2, d1 * 57.0 / 185.0, cpx);

		p1 = p2;
		p2 += vCr * 3;
		makeSimpleTube(p1, p2, d1 * 122.0 / 185.0, d1 * 130.0 / 185.0, cpx);
		makeFlatRing(p1, vCr, d1 * 57.0 / 185.0, d1 * 122.0 / 185.0, cpx);
		makeFlatRing(p2, vCr, d1 * 130.0 / 185.0, d1, cpx);

		p1 = p2;
		p2 += vCr * 17;
		makeVerySimpleTube(p1, p2, d1, cpx);
		makeFlatRing(p2, vCr, d1 * 57.0 / 185.0, d1, cpx);

		points[0] = p1;
		points[1] = p2;
		points[0] += vUp * (d1 * 72.5 / 185.0);
		points[1] += vUp * (d1 * 72.5 / 185.0);

		points[0].rotateBy(M_PI * 0.25, vCr, p1);
		points[1].rotateBy(M_PI * 0.25, vCr, p1);

		for (int i = 0; i < 4; i++) {
			points[0].rotateBy(M_PI * 0.5, vCr, p1);
			points[1].rotateBy(M_PI * 0.5, vCr, p1);
			makeSymbolicCircle(points[0], vCr, d1 * 18.0 / 185.0);
			makeSymbolicCircle(points[1], vCr, d1 * 18.0 / 185.0);
		}
	}
	return 0;
}

short CGeneralBlockCreator::makeDishWash()
{
	// dishWasher

	ads_real W = 596; get_val("W", W); //W = 596;
	ads_real L = 550; get_val("L", L); //= 596;
	ads_real H = 850; get_val("H", H); //H = 850;
	ads_real d1 = 25; get_val("d1", d1); //Cole water connector = 25;
	ads_real d2 = 15; get_val("d2", d2); // Sewage connector = 15;

	FdPoint3d startP(0, 0, 0),
		endP(0, 0, 0);
	double height1[2] = { 8 * L / 11 + L / 22, 8 * L / 11 + L / 22 };
	double width[2] = { W, W };
	startP.y = L / 22;
	endP.y = startP.y;
	endP.z = H / 7;
	FdPoint3d box1[2] = { startP, endP };
	int count = 1;
	makeBox(count, box1, height1, width, false);
	makeRectFace(startP, vz, vy, 8 * L / 11 + L / 22, W);
	makeRectFace(endP, vz, vy, 8 * L / 11 + L / 22, W);


	// back
	startP.y = -4 * L / 11 - L / 44;
	startP.z = 3 * H / 17;
	endP.y = startP.y;
	endP.z = H;
	double height2[2] = { L / 11, L / 11 };
	FdPoint3d box2[2] = { startP, endP };
	makeBox(count, box2, height2, width, false);
	makeRectFace(startP, vz, vy, L / 11, W);
	makeRectFace(endP, vz, vy, L / 11, W);

	//hoses
	startP.y = -7 * L / 22;
	startP.z = 3 * H / 35;
	startP.x = W / 2 - W / 20;
	endP.z = startP.z;
	endP.x = startP.x;
	endP.y = startP.y - L / 11;
	makeVerySimpleTube(startP, endP, d1, cpx);
	makeVerySimpleTube(startP, endP, d1 + 5, cpx);
	makeFlatRing(endP, vy, d1, d1 + 5, cpx);
	FdPoint3d h2(endP.x, endP.y, endP.z + L / 11);
	//FdPoint3d center1[4] = { endP, h2, h3, h4  };
	makeTubularBend(h2, vx, -vy, L / 11, d1, 90, 4 * cpx, 15, true, false);
	startP.y = endP.y - L / 11;
	startP.z = endP.z + L / 11;
	endP.y = startP.y;
	endP.z = startP.z + H / 3;
	makeVerySimpleTube(startP, endP, d1, cpx);
	startP.z = endP.z;
	endP.z += L / 11;
	makeVerySimpleTube(startP, endP, d1 + 5, cpx);
	makeFlatRing(startP, vz, d1, d1 + 5, cpx);
	makeFlatRing(endP, vz, d1, d1 + 5, cpx);


	startP.y = -7 * L / 22;
	startP.z = 3 * H / 35;
	endP.z = startP.z;
	endP.y = startP.y - L / 11;
	startP.x = -W / 2 + W / 20;
	endP.x = startP.x;
	makeVerySimpleTube(startP, endP, d2, cpx);
	makeVerySimpleTube(startP, endP, d2 + 5, cpx);
	makeFlatRing(endP, vy, d2, d2 + 5, cpx);
	FdPoint3d h3(endP.x, endP.y, endP.z + L / 11);
	//FdPoint3d center1[4] = { endP, h2, h3, h4  };
	makeTubularBend(h3, vx, -vy, L / 11, d2, 90, 4 * cpx, 15, true, false);
	startP.y = endP.y - L / 11;
	startP.z = endP.z + L / 11;
	endP.y = startP.y;
	endP.z = startP.z + H / 3;
	makeVerySimpleTube(startP, endP, d2, cpx);
	startP.z = endP.z;
	endP.z += L / 11;
	makeVerySimpleTube(startP, endP, d2 + 5, cpx);
	makeFlatRing(startP, vz, W / 30, d2 + 5, cpx);
	makeFlatRing(endP, vz, d2, d2 + 5, cpx);

	//front
	startP.x = 0;
	startP.y = 3 * L / 22 - L / 44;
	startP.z = H / 7;
	endP.x = 0;
	endP.y = startP.y;
	endP.z = H;
	double height3[2] = { 10 * L / 11 , 10 * L / 11 };
	FdPoint3d box3[2] = { startP, endP };
	bool sides1[4] = { true, false, true, true };
	bool sides[4] = { true, true, true, true };
	bool connector[2] = { false, false };
	makeBox(count, box3, height3, width, sides, connector, false, false);
	makeRectFace(startP, vz, vy, 10 * L / 11, W);
	makeRectFace(endP, vz, vy, 10 * L / 11, W);

	// gate
	startP.z += H / 50;
	endP.z += -H / 50;
	startP.y += 5 * L / 11 + L / 100;
	endP.y = startP.y;
	FdPoint3d box4[2] = { startP, endP };
	double width2[2] = { W - W / 15, W - W / 15 };
	double height4[2] = { L / 50, L / 50 };
	makeBox(count, box4, height4, width2, false);
	makeRectFace(endP, vz, vy, L / 50, W - W / 15);
	startP.z += -H / 50;
	endP.z = startP.z + H / 50;
	FdPoint3d box8[2] = { startP, endP };
	makeBox(count, box8, height4, width, false);
	makeRectFace(startP, vz, vy, L / 50, W);
	endP.z = H - H / 20;
	startP.y += L / 100 + L / 40;
	endP.y = startP.y;
	double height5[2] = { L / 20, L / 20 };
	FdPoint3d box5[2] = { startP, endP };
	makeBox(count, box5, height5, width, false);
	makeRectFace(startP, vz, vy, L / 20, W);
	setMeshColor(0, 0, 0);
	startP.z = endP.z;
	endP.z = H;
	FdPoint3d box6[2] = { startP, endP };
	makeBox(count, box6, height5, width, false);
	makeRectFace(endP, vz, vy, L / 20, W);
	setMeshColor(0);
	startP.z = H / 7;
	startP.y += L / 40 + L / 80;
	endP.y = startP.y;
	endP.z = 16 * H / 17;
	double height6[2] = { L / 40, L / 40 };
	FdPoint3d box7[2] = { startP, endP };
	makeBox(count, box7, height6, width, false);
	makeRectFace(startP, vz, vy, L / 40, W);
	makeRectFace(endP, vz, vy, L / 40, W);
	startP.z = endP.z;
	endP.z += H / 100;
	FdPoint3d box9[2] = { startP, endP };
	double width3[2] = { W / 5, W / 5 };
	setMeshColor(2);
	makeBox(count, box9, height6, width3, sides1, connector, false, false);
	makeRectFace(endP, vz, vy, L / 40, W / 5);
	makeRectFace(endP, vz, vy, L / 40, W / 5);
	setMeshColor(0);
	startP.x = W / 4 + W / 20;
	endP.x = startP.x;
	double width4[2] = { W / 2 - W / 10, W / 2 - W / 10 };
	FdPoint3d box10[2] = { startP, endP };
	makeBox(count, box10, height6, width4, false);
	startP.x = -W / 4 - W / 20;
	endP.x = startP.x;
	FdPoint3d box11[2] = { startP, endP };
	makeBox(count, box11, height6, width4, false);
	startP.x = 0;
	endP.x = 0;
	startP.z = endP.z;
	endP.z = H;
	FdPoint3d box12[2] = { startP, endP };
	makeBox(count, box12, height6, width, false);
	makeRectFace(endP, vz, vy, L / 40, W);

	//deatails
	FdPoint3d sp, ep;
	sp.x = W / 8 - W / 16;
	ep.x = W / 8 + W / 16;
	sp.y = startP.y + L / 40;
	ep.y = startP.y + L / 40;
	sp.z = H / 7;
	ep.z = 10 * H / 17;
	makeSymbolicLine(sp, ep);
	sp.x = 3 * W / 8 - W / 16;
	ep.x = 3 * W / 8 + W / 16;
	makeSymbolicLine(sp, ep);
	sp.x = -W / 8 - W / 16;
	ep.x = -W / 8 + W / 16;
	makeSymbolicLine(sp, ep);
	sp.x = -3 * W / 8 - W / 16;
	ep.x = -3 * W / 8 + W / 16;
	makeSymbolicLine(sp, ep);
	return 0;
}

short CGeneralBlockCreator::makeFWaterMeter()
{
	//FWaterMeter
//makeMainTube
	ads_real h = 78; get_val("d", h); // h = 78
	ads_real H = 130; get_val("H", H); // H = 130
	ads_real L = 200; get_val("L", L); //L = 200


	int n = 20;
	//righttube
	FdPoint3d startP(-L / 2 - L / 50, 0, 0);
	FdPoint3d endP(L / 2 + L / 50, 0, 0);
	FdPoint3d middleP(0, 0, 0);
	FdPoint3d sp;
	makeVerySimpleTube(startP, endP, h, n);
	makeFlatRing(startP, vx, h, 2 * h - h / 2, n);
	makeFlatRing(endP, vx, h, 2 * h - h / 2, n);
	middleP.x = -L / 2;
	makeVerySimpleTube(startP, middleP, 2 * h - h / 2, n);
	middleP.x = L / 2;
	makeVerySimpleTube(endP, middleP, 2 * h - h / 2, n);
	middleP.x = 0;
	startP.x = -L / 2;
	endP.x = -L / 2 + L / 10;
	makeVerySimpleTube(startP, endP, 2 * h, n);
	makeFlatRing(startP, vx, h, 2 * h, n);
	makeFlatRing(endP, vx, h, 2 * h, n);

	//righthole
	double hole = h - h / 8;
	sp.x = -L / 2;
	sp.z = 0.92 * hole;
	sp.y = 0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.92 * hole;
	sp.y = 0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.92 * hole;
	sp.y = -0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.92 * hole;
	sp.y = -0.38 * hole;;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.38 * hole;
	sp.y = 0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.38 * hole;
	sp.y = 0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.38 * hole;
	sp.y = -0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.38 * hole;
	sp.y = -0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);

	sp.x = -L / 2 + L / 10;
	sp.z = 0.92 * hole;
	sp.y = 0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.92 * hole;
	sp.y = 0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.92 * hole;
	sp.y = -0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.92 * hole;
	sp.y = -0.38 * hole;;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.38 * hole;
	sp.y = 0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.38 * hole;
	sp.y = 0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.38 * hole;
	sp.y = -0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.38 * hole;
	sp.y = -0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);

	//addThinCircle(startP, vx, 15);

	//lefttube
	startP.y = 0;
	startP.z = 0;
	startP.x = L / 2;
	endP.x = L / 2 - L / 10;
	makeVerySimpleTube(startP, endP, 2 * h, n);
	makeFlatRing(startP, vx, h, 2 * h, n);
	makeFlatRing(endP, vx, h, 2 * h, n);
	makeDisc(middleP, vy, h + 20, h + 20, n, true);

	//lefthole

	sp.x = L / 2;
	sp.z = 0.92 * hole;
	sp.y = 0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.92 * hole;
	sp.y = 0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.92 * hole;
	sp.y = -0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.92 * hole;
	sp.y = -0.38 * hole;;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.38 * hole;
	sp.y = 0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.38 * hole;
	sp.y = 0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.38 * hole;
	sp.y = -0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.38 * hole;
	sp.y = -0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);

	sp.x = L / 2 - L / 10;
	sp.z = 0.92 * hole;
	sp.y = 0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.92 * hole;
	sp.y = 0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.92 * hole;
	sp.y = -0.38 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.92 * hole;
	sp.y = -0.38 * hole;;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.38 * hole;
	sp.y = 0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.38 * hole;
	sp.y = 0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = 0.38 * hole;
	sp.y = -0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);
	sp.z = -0.38 * hole;
	sp.y = -0.92 * hole;
	makeSymbolicCircle(sp, vx, h / 5);

	//UpperDetails
	setMeshColor(255, 255, 255);
	endP.x = 0;
	endP.y = H - 20;
	makeSimpleTube(middleP, endP, h - 20, h - 20, n);
	makeDisc(endP, vy, h - 19, 20, n, true);
	setMeshColor(0);
	startP.x = 0;
	startP.y = h / 2 + 10;
	endP.y = h / 2 + 30;
	startP.z = 10;
	endP.z = 10;
	makeVerySimpleTube(startP, endP, h + 20, n);
	makeFlatDisc(startP, vy, h + 20, n);
	makeFlatDisc(endP, vy, h + 20, n);
	startP.z = -10;
	endP.z = -10;
	makeVerySimpleTube(startP, endP, h + 20, n);
	makeFlatDisc(startP, vy, h + 20, n);
	makeFlatDisc(endP, vy, h + 20, n);
	startP.z = 0;
	endP.z = 0;
	FdPoint3d central[2] = { startP, endP };
	double w[2] = { h + 20, h + 20 };
	double he[2] = { 20, 20 };
	makeBox(1, central, he, w, false);
	makeRectFace(startP, vy, vz, 20, h + 20);
	makeRectFace(endP, vy, vz, 20, h + 20);
	endP.x = 0.7 * h / 2;
	endP.z = 0.7 * h / 2 + 7;
	makeScrew(endP, vy, vx, 5, 10, true, true);
	endP.x = -0.7 * h / 2;
	endP.z = 0.7 * h / 2 + 7;
	makeScrew(endP, vy, vx, 5, 10, true, true);
	endP.x = 0.7 * h / 2;
	endP.z = -0.7 * h / 2 - 7;
	makeScrew(endP, vy, vx, 5, 10, true, true);
	endP.x = -0.7 * h / 2;
	endP.z = -0.7 * h / 2 - 7;
	makeScrew(endP, vy, vx, 5, 10, true, true);

	return 0;
}

short CGeneralBlockCreator::makeWaterCirPump()
{
	//makeWaterCirPump

//makeMain
	ads_real L; get_val("L", L); // L = 180 //Length
	ads_real W; get_val("W", W); //W = 130; //Width
	ads_real H; get_val("H", H); // H = 105; //Height
	ads_real d; get_val("d", d); // d = 38; //Diameter
	int n = 20;
	FdPoint3d startP(0, 0, 0),
		endP(5, 0, 0);
	makeVerySimpleTube(startP, endP, d, n);
	makeFlatRing(startP, vx, d - 3, d, n);
	makeFlatRing(endP, vx, d - 3, d, n);
	startP.x += 5;
	endP.x += L / 6;
	makeVerySimpleTube(startP, endP, d - 3, n);
	startP.x += L / 6;
	endP.x += L / 3;
	makeSimpleTube(startP, endP, d - 3, d + 3, n);
	double latAngles[2] = { 0, 90 };
	double longAngles[2] = { 0, 360 };
	double axisLengths[3] = { d / 12, d + 3, d + 3 };
	int cpx[2] = { 20, 20 };
	makeSpheroidSection(endP, vx, latAngles, longAngles, axisLengths, cpx);
	startP.x = L;
	makeVerySimpleTube(startP, endP, d - 3, n);
	endP.x += L / 2 + 5;
	makeVerySimpleTube(startP, endP, d, n);
	makeFlatRing(startP, vx, d - 3, d, n);
	makeFlatRing(endP, vx, d - 3, d, n);

	//makeMiddlePart

	startP.x = L / 2;
	endP.x = L / 2;
	endP.y += H;
	makeVerySimpleTube(startP, endP, 2 * W / 3, n);
	makeFlatDisc(startP, vy, 2 * W / 3, n);
	makeFlatRing(endP, vy, 2 * W / 12, 2 * W / 3, n);
	makeFlatDisc(endP, vy, 2 * W / 12 - 2, n);
	makeRectFace(endP, vz, vy, 5, 2 * W / 12 - 2);
	startP.y += H / 3;
	endP.y = startP.y + 10;
	double height[2] = { 2 * W / 3, 2 * W / 3 };
	double width[2] = { 2 * W / 3, 2 * W / 3 };
	FdPoint3d central[2] = { startP, endP };
	makeBox(1, central, width, height, false);
	makeRectFace(startP, vy, vz, 2 * W / 3, 2 * W / 3);
	makeRectFace(endP, vy, vz, 2 * W / 3, 2 * W / 3);
	startP.y += 10;
	startP.x += W / 3 - 5;
	startP.z += W / 3 - 5;
	makeScrew(startP, vy, vx, 5, 5, true, true);
	startP.z += -2 * W / 3 + 10;
	makeScrew(startP, vy, vx, 5, 5, true, true);
	startP.x += -2 * W / 3 + 10;
	makeScrew(startP, vy, vx, 5, 5, true, true);
	startP.z += 2 * W / 3 - 10;
	makeScrew(startP, vy, vx, 5, 5, true, true);

	//makeRemote
	startP.x = L / 2;
	endP.x = L / 2;
	startP.y = 0;
	endP.y = 0;
	startP.z = 0;
	endP.z = 0;
	startP.y = H / 7;
	endP.y = H / 7;
	startP.z += W / 3;
	endP.z += 2 * W / 3;
	FdPoint3d box1[2] = { startP, endP };
	double h1[2] = { 2 * W / 3, 2 * W / 3 };
	double w1[2] = { 2 * H / 7, 2 * H / 7 };
	makeBox(1, box1, w1, h1, false);
	makeRectFace(startP, vz, vy, 2 * H / 7, 2 * W / 3);
	makeRectFace(endP, vz, vy, 2 * H / 7, 2 * W / 3);
	startP.y += H / 7 + 5 * H / 14;
	endP.y += H / 7 + 5 * H / 14;
	endP.z += -W / 9 + 6;
	FdPoint3d box3[2] = { startP, endP };
	double h3[2] = { 5 * H / 7, 5 * H / 7 };
	double w3[2] = { 5 * H / 7, 5 * H / 7 };
	makeBox(1, box3, w3, h3, false);
	makeRectFace(startP, vz, vy, 5 * H / 7, 5 * H / 7);
	makeRectFace(endP, vz, vy, 5 * H / 7, 5 * H / 7);
	endP.z = startP.z + 6;
	FdPoint3d box2[2] = { startP, endP };
	double h2[2] = { 2 * W / 3, 2 * W / 3 };
	double w2[2] = { 5 * H / 7, 5 * H / 7 };
	makeBox(1, box2, w2, h2, false);
	makeRectFace(startP, vz, vy, 5 * H / 7, 2 * W / 3);
	makeRectFace(endP, vz, vy, 5 * H / 7, 2 * W / 3);
	startP.z += W / 9 + 6;
	startP.x += 5 * H / 14;
	makeScrew(startP, vx, vz, 2 * W / 9, W / 9, true, true);
	startP.x += W / 9;
	endP.x = startP.x + W / 9;
	endP.y = startP.y;
	endP.z = startP.z;
	makeVerySimpleTube(startP, endP, 2 * W / 9, n);
	makeFlatDisc(startP, vx, 2 * W / 9, n);
	makeFlatDisc(endP, vx, 2 * W / 9, n);
	startP.y += H / 7;
	startP.x = L / 2;
	startP.x += -H / 7;
	startP.z += W / 9;
	endP.x = startP.x;
	endP.y = startP.y;
	endP.z = startP.z + W / 9 - 6;
	makeVerySimpleTube(startP, endP, H / 7, n);
	makeFlatDisc(endP, vz, H / 7, n);
	startP.z += W / 18 - 3;
	endP.x += -H / 7;
	endP.y += H / 7;
	endP.z += -W / 9 + 6;
	FdPoint3d box4[2] = { startP, endP };
	FdVector3d vector(-1, 1, 0);
	vector.normalize();
	double width4[2] = { H / 7, 0 };
	double height4[2] = { W / 9 - 6, 0 };
	makeBox(1, box4, height4, width4, false);
	return 0;
}

short CGeneralBlockCreator::makeWaterMeter()
{
	//makeWaterMeter
//mainTube
	ads_real L = 190; get_val("L", L); // L = 190
	ads_real H = 111; get_val("H", H); // H = 111
	ads_real B = L / 2;
	ads_real D = 25; get_val("D", D); // D = 25;
	int n = 20;
	FdPoint3d startP(0, 0, 0);
	FdPoint3d endP(0, 0, 0);
	FdPoint3d middleP(0, 0, 0);
	endP.y = H / 2 - 15;
	startP.y = -H / 2 + 10;
	makeSimpleTube(startP, endP, B - 20, B - 20, n);
	makeFlatDisc(endP, vy, B - 20, n);
	double latAng[2] = { 90, 180 };
	double longAng[2] = { 0, 360 };
	double diam[3] = { 10, B - 20, B - 20 };
	int cpx[2] = { 20, 20 };
	makeSpheroidSection(startP, -vy, latAng, longAng, diam, cpx);
	startP.y = 0;
	endP.y = 0;
	startP.x = -L / 2 - L / 10 + 30;
	endP.x = L / 2 - 30;
	makeSimpleTube(middleP, startP, B - 20, D, n);
	makeSimpleTube(middleP, endP, B - 20, D, n);
	endP.x = -L / 2 - L / 10;
	setMeshColor(204, 204, 0);
	makeVerySimpleTube(startP, endP, D + 5, n);
	makeFlatRing(startP, vx, D, D + 5, n);
	makeFlatRing(endP, vx, D, D + 5, n);
	startP.x = L / 2;
	endP.x = L / 2 - 30;
	makeVerySimpleTube(startP, endP, D + 5, n);
	makeFlatRing(startP, vx, D, D + 5, n);
	makeFlatRing(endP, vx, D, D + 5, n);
	setMeshColor(0);

	//UpperDetails
	FdVector3d vector(-1, 1, 0);
	vector.normalize();
	double a = B / 2 - 10 + L / 20;
	double b = L / 2 + L / 10;
	startP.x = -a + D / 2;
	startP.y = a * D / (2 * b) + (b - a) * (B - 20) / (2 * b) - D / 2;
	endP.x = startP.x - L / 20 - D / 2;
	endP.y = startP.y + L / 20 + D / 2;
	makeVerySimpleTube(startP, endP, D / 2, n);
	makeFlatDisc(endP, vector, D / 2, n);
	setMeshColor(204, 204, 0);
	makeScrew(endP, vector, vy, D / 2, 5, true, true);
	startP.x = 0;
	startP.y = H / 2 - 15;
	endP = startP;
	endP.y = H / 2 + 15;
	makeVerySimpleTube(startP, endP, B, n);
	makeFlatDisc(endP, vy, B, n);
	makeFlatDisc(startP, vy, B, n);
	return 0;
}

short CGeneralBlockCreator::makeSewerAerVale()
{
	//// SewerAerVale

	ads_real H; get_val("H", H); //Height = 70;
	ads_real L; get_val("D", L); //Diameter = 32;
	int n = 4 * cpx;
	FdPoint3d startP(0, 0, 0),
		endP(0, 0, 0);
	double dis = 3 * L / 20;
	endP.y = 5 * H / 14;
	makeVerySimpleTube(startP, endP, L, n);
	makeFlatDisc(startP, vy, L, n);
	startP.y = endP.y;
	endP.y += H / 28;
	makeVerySimpleTube(startP, endP, L + dis, n);
	makeFlatDisc(startP, vy, L + dis, n);
	makeFlatDisc(endP, vy, L + dis, n);
	startP.y = endP.y;
	endP.y += H / 28;
	makeVerySimpleTube(startP, endP, L - dis / 2, n);
	makeFlatDisc(endP, vy, L - dis / 2, n);
	startP.y = endP.y;
	endP.y += 3 * H / 28;
	makeVerySimpleTube(startP, endP, L - dis - dis / 2, n);
	startP.y = endP.y;
	endP.y += 3 * H / 28;
	makeVerySimpleTube(startP, endP, L, n);
	makeFlatDisc(startP, vy, L, n);
	makeFlatDisc(endP, vy, L, n);
	startP.y = endP.y;
	endP.y += 5 * H / 14 - H / 14;
	makeVerySimpleTube(startP, endP, L - dis / 2, n);
	makeFlatDisc(endP, vy, L - dis / 2, n);
	startP.y = endP.y;
	endP.y = H;
	makeVerySimpleTube(startP, endP, L - dis, n);
	makeFlatDisc(endP, vy, L - dis, n);

	return 0;
}

short CGeneralBlockCreator::makeAntiConVale()
{
	//AntiConVale

	ads_real A; get_val("L", A); //Lenght = 65
	ads_real B; get_val("D", B); //Diameter = 15;
	ads_real C = 26.7 * A / 65;
	ads_real D; get_val("H", D); //Height = 25.5
	int n = 20;

	FdPoint3d startP(A / 2, 0, 0),
		endP(-A / 2, 0, 0);
	//main

	double hw[2] = { B, B / 1.732 };
	double tup[3] = { B / 1.732, B / 1.732, 0 };
	makeRectToTubeTransition(startP, vx, vy, hw, startP, tup, 20);
	FdVector3d vt1(0, 1, -1.732);
	FdVector3d vt2(0, 1, 1.732);
	vt1.normalize();
	vt2.normalize();
	makeRectToTubeTransition(startP, vx, vt1, hw, startP, tup, 20);
	makeRectToTubeTransition(startP, vx, vt2, hw, startP, tup, 20);
	double rec = A - C;
	startP.x += -rec / 2;
	makeScrew(startP, vx, vy, B / 1.732 * 2, rec / 2, true, false);

	makeRectToTubeTransition(endP, vx, vy, hw, endP, tup, 20);
	makeRectToTubeTransition(endP, vx, vt1, hw, endP, tup, 20);
	makeRectToTubeTransition(endP, vx, vt2, hw, endP, tup, 20);
	endP.x += rec / 2;
	makeScrew(endP, -vx, vy, B / 1.732 * 2, rec / 2, true, false);
	makeVerySimpleTube(startP, endP, B - B / 10, n);

	//upper
	FdPoint3d upP(0, 0, 0);
	upP.x = startP.x;
	upP.y = startP.y + D - D / 6;
	makeVerySimpleTube(startP, upP, C / 2, n);
	makeFlatDisc(upP, vy, C / 2, n);
	startP.y = upP.y;
	upP.y += D / 12;
	makeVerySimpleTube(startP, upP, C / 2 - C / 10, n);
	makeFlatDisc(upP, vy, C / 2 - C / 10, n);
	startP.y = upP.y;
	upP.y += D / 12;
	makeScrew(startP, vy, vx, C / 2 - C / 10, D / 12, false, false);
	makeScrew(startP, vy, vx, C / 8, D / 12, false, false);
	double w1[2] = { C / 4 - C / 20, C / 16 };
	double h1[2] = { 1 , 1 };
	startP.y = upP.y - 1;
	upP.y = startP.y;
	startP.x += (C / 4 - C / 20) * 0.866;
	upP.x += 0.866 * C / 16;
	FdPoint3d central1[2] = { startP , upP };
	makeBox(1, central1, w1, h1, false);
	startP.x = (C / 2 + 0.5 * 0.866 * (C / 4 - C / 20));
	upP.x = (C / 2 + 0.866 * C / 32);
	startP.z = (0.5 * (C / 4 - C / 20) + 0.25 * (C / 4 - C / 20));
	upP.z = (C / 32 + C / 64);
	FdPoint3d central2[2] = { startP,upP };
	makeBox(1, central2, w1, h1, false);
	startP.z = -(0.5 * (C / 4 - C / 20) + 0.25 * (C / 4 - C / 20));
	upP.z = -(C / 32 + C / 64);
	FdPoint3d central3[2] = { startP, upP };
	makeBox(1, central3, w1, h1, false);
	startP.x = (C / 2 - 0.5 * 0.866 * (C / 4 - C / 20));
	upP.x = (C / 2 - 0.866 * C / 32);
	FdPoint3d central4[2] = { startP, upP };
	makeBox(1, central4, w1, h1, false);
	startP.z = (0.5 * (C / 4 - C / 20) + 0.25 * (C / 4 - C / 20));
	upP.z = (C / 32 + C / 64);
	FdPoint3d central5[2] = { startP, upP };
	makeBox(1, central5, w1, h1, false);
	startP.z = 0;
	upP.z = 0;
	startP.x = C / 2 - (C / 4 - C / 20) * 0.866;
	upP.x = C / 2 - 0.866 * C / 16;
	FdPoint3d central6[2] = { startP, upP };
	makeBox(1, central6, w1, h1, false);


	upP.x = endP.x;
	upP.y = endP.y + D - D / 6;
	upP.z = 0;
	makeVerySimpleTube(endP, upP, C / 2, n);
	makeFlatDisc(upP, vy, C / 2, n);
	endP.y = upP.y;
	upP.y += D / 12;
	makeVerySimpleTube(endP, upP, C / 2 - C / 10, n);
	makeFlatDisc(upP, vy, C / 2 - C / 10, n);
	endP.y = upP.y;
	upP.y += D / 12;
	makeScrew(endP, vy, vx, C / 2 - C / 10, D / 12, false, false);
	makeScrew(endP, vy, vx, C / 8, D / 12, false, false);
	endP.y = upP.y - 1;
	upP.y = endP.y;
	endP.x += (C / 4 - C / 20) * 0.866;
	upP.x += 0.866 * C / 16;
	FdPoint3d central7[2] = { endP , upP };
	makeBox(1, central7, w1, h1, false);
	endP.x = (-C / 2 + 0.5 * 0.866 * (C / 4 - C / 20));
	upP.x = (-C / 2 + 0.866 * C / 32);
	endP.z = (0.5 * (C / 4 - C / 20) + 0.25 * (C / 4 - C / 20));
	upP.z = (C / 32 + C / 64);
	FdPoint3d central8[2] = { endP,upP };
	makeBox(1, central8, w1, h1, false);
	endP.z = -(0.5 * (C / 4 - C / 20) + 0.25 * (C / 4 - C / 20));
	upP.z = -(C / 32 + C / 64);
	FdPoint3d central9[2] = { endP, upP };
	makeBox(1, central9, w1, h1, false);
	endP.x = (-C / 2 - 0.5 * 0.866 * (C / 4 - C / 20));
	upP.x = (-C / 2 - 0.866 * C / 32);
	FdPoint3d central10[2] = { endP, upP };
	makeBox(1, central10, w1, h1, false);
	endP.z = (0.5 * (C / 4 - C / 20) + 0.25 * (C / 4 - C / 20));
	upP.z = (C / 32 + C / 64);
	FdPoint3d central11[2] = { endP, upP };
	makeBox(1, central11, w1, h1, false);
	endP.z = 0;
	upP.z = 0;
	endP.x = -C / 2 - (C / 4 - C / 20) * 0.866;
	upP.x = -C / 2 - 0.866 * C / 16;
	FdPoint3d central12[2] = { endP, upP };
	makeBox(1, central12, w1, h1, false);

	//

	return 0;
}

short CGeneralBlockCreator::makeReflexSL()
{
	//make Tank C
	ads_real dia;			get_val("D", dia); //diameter = 480
	ads_real hei;			get_val("H", hei); //height = 1386;
	ads_real d1 = 25;		get_val("d", d1); //Connector = 25;
	ads_real h2 = 200;			get_val("H2", h2);
	double heifoot = 50 + dia / 4;
	double heitube = hei - heifoot - dia / 4;
	double diefoot = 0.12 * dia;
	double diehole = 13;
	FdPoint3d fp1(0, 0, heitube / 2),
		fp2(0, 0, 0);
	FdPoint3d fptube1[2] = { fp1, fp2 };
	makeSimpleTube(fptube1, dia, dia, cpx);
	FdPoint3d fp3(0, 0, 0),
		fp4(0, 0, -heitube / 2);
	FdPoint3d fptube2[2] = { fp3, fp4 };
	makeSimpleTube(fptube2, dia, dia, cpx);
	int n[2] = { cpx, 4 * cpx };
	double latAngles[2] = { 90, 180 };
	double longAngles[2] = { 0, 360 };
	double axisLengths[3] = { dia / 2, dia, dia };
	makeSpheroidSection(fp1, vz, latAngles, longAngles, axisLengths, n);
	makeSpheroidSection(fp4, -vz, latAngles, longAngles, axisLengths, n);

	// make legs
	FdVector3d vector[2] = { vz, vz };
	FdVector3d vt1(1.7, 1, 0);
	FdVector3d vt2(-1.7, 1, 0);
	FdVector3d vector2[2] = { vt1, vt1 };
	FdVector3d vector3[2] = { vt2, vt2 };
	bool connector[2] = { false,false };
	bool sides[4] = { false, true, true, true };
	bool sides1[4] = { true, true, true, false };
	double width[2] = { diefoot, diefoot };
	double height[2] = { diefoot, diefoot };
	double hw[2] = { diefoot , diefoot };
	double hw2[2] = { diefoot / 2, diefoot };
	double holePara[3] = { diehole, diehole, 0 };
	double holePara2[3] = { diehole / 2, diehole, 0 };
	double dis = (dia / 2) / 1.4;
	FdPoint3d fl11(0, -dis, -heitube / 2),
		fl12(0, -dis, -heitube / 2 - heifoot);
	FdPoint3d fl1[2] = { fl11, fl12 };
	makeBox(1, fl1, vector, width, height, sides1, connector, false, false);
	makeRectToTubeTransition(fl12, vz, vy, hw, fl12, holePara, cpx);
	FdPoint3d fl21(dis * 0.86, dis / 2, -heitube / 2),
		fl22(dis * 0.86, dis / 2, -heitube / 2 - heifoot);
	FdPoint3d fl2[2] = { fl21, fl22 };
	makeBox(1, fl2, vector, vector2, width, height, sides, false, false, 5, 5, 10);
	makeRectToTubeTransition(fl22, vz, vt1, hw2, fl22, holePara2, cpx);
	FdPoint3d fl31(-dis * 0.86, dis / 2, -heitube / 2),
		fl32(-dis * 0.86, dis / 2, -heitube / 2 - heifoot);
	FdPoint3d fl3[2] = { fl31, fl32 };
	makeBox(1, fl3, vector, vector3, width, height, sides, false, false, 5, 5, 10);
	makeRectToTubeTransition(fl32, vz, vt2, hw2, fl32, holePara2, cpx);

	// make top things
	double baseZ = heitube / 2 + dia * 0.22;
	double z_offset = 0;

	FdPoint3d ft1(0, dis, baseZ - 40 + z_offset),
		ft4(0, dis, baseZ + z_offset),
		ft2(dis * 0.86, dis / 2, baseZ - 20 + z_offset),
		ft3(-dis * 0.86, dis / 2, baseZ - 20 + z_offset),
		ft5(dis * 0.86 + 12, dis / 2, baseZ - 20 + 2 * 17.3 - 12.11 + z_offset),
		ft6(-dis * 0.86 - 12, dis / 2, baseZ - 20 + 2 * 17.3 - 12.11 + z_offset);
	makeSimpleTube(ft1, ft4, 40, 10, cpx);
	FdVector3d ve1(1, 0, 1.73),
		ve2(-1, 0, 1.73);
	ve1.normalize();
	ve2.normalize();
	makeRectFace(ft2, vy, ve1, 40, 40);
	makeRectFace(ft3, vy, ve2, 40, 40);
	makeFlatRing(ft5, vy, 15, 40, cpx);
	makeFlatRing(ft6, vy, 15, 40, cpx);

	// connector
	FdPoint3d sp, ep;
	sp.z = -heitube / 2 - heifoot + h2;
	ep.z = sp.z;
	sp.y = dia / 2 - dia / 10;
	ep.y = dia / 2 + 20;
	makeVerySimpleTube(sp, ep, d1, 20);
	makeVerySimpleTube(sp, ep, d1 + 5, 20);
	makeFlatRing(ep, vy, d1, d1 + 5, 20);

	return 0;
}

short CGeneralBlockCreator::makeReflexDT()
{
	// make tank
	ads_real D = 400;  get_val("D", D); //diameter = 400;
	ads_real H = 800;  get_val("H", H); // height = 800;
	ads_real d = 25;    get_val("d", d); //Connector = 25;
	ads_real h2 = 0.075 * H; get_val("H2", h2);
	char* con_t;	get_val("con_t", con_t);
	FdVector3d vUp(vz), vN(vx);
	FdVector3d vCr = vUp.crossProduct(vN);
	FdPoint3d p0 = FdPoint3d(0, 0, 0);

	//make legs - S
	double legWidth = 0.1 * D;
	double legHeight;
	if (strcmp(con_t, "Non-flange") == 0) {
		legHeight = 0.3 * H;
		FdPoint3d points[2] = { p0, p0 };
		points[0] += vCr * 0.4 * D;
		points[1] += vCr * 0.4 * D;
		points[1] += vUp * legHeight;
		FdVector3d nVs[2] = { vUp, vUp };
		FdVector3d uVs[2] = { vCr, vCr };
		double tabHeights[2] = { legWidth, legWidth };
		double tabWidths[2] = { legWidth, legWidth };
		bool sides[4] = { false, true, true, true };
		for (int i = 0; i < 3; i++) {
			points[0].rotateBy(M_PI * 2 / 3, vUp, p0);
			points[1].rotateBy(M_PI * 2 / 3, vUp, p0);
			uVs[0].rotateBy(M_PI * 2 / 3, vUp);
			uVs[1].rotateBy(M_PI * 2 / 3, vUp);
			makeBox(1, points, nVs, uVs, tabWidths, tabHeights, sides, true, true, 0, 0, 0);
		}

	}
	else if (strcmp(con_t, "Flange") == 0) {
		legHeight = 0.35 * H;
		FdPoint3d points[2] = { p0, p0 };
		points[0] += vCr * 0.4 * D;
		points[1] += vCr * 0.33 * D;
		points[1] += vUp * legHeight;
		FdVector3d nVs[2] = { vUp, vUp };
		FdVector3d uVs[2] = { vCr, vCr };
		double tabHeights[2] = { legWidth, legWidth };
		double tabWidths[2] = { legWidth, legWidth };
		bool sides[4] = { false, true, true, true };
		for (int i = 0; i < 3; i++) {
			points[0].rotateBy(M_PI * 2 / 3, vUp, p0);
			points[1].rotateBy(M_PI * 2 / 3, vUp, p0);
			uVs[0].rotateBy(M_PI * 2 / 3, vUp);
			uVs[1].rotateBy(M_PI * 2 / 3, vUp);
			makeBox(1, points, nVs, uVs, tabWidths, tabHeights, sides, true, true, 0, 0, 0);
		}
		FdPoint3d p1 = points[0];
		p1 += vCr * legWidth * 0.25;
		FdVector3d uV = vCr;
		for (int i = 0; i < 3; i++) {
			p1.rotateBy(M_PI * 2 / 3, vUp, p0);
			uV.rotateBy(M_PI * 2 / 3, vUp);
			makeRectFace(p1, vUp, uV, legWidth * 1.5, legWidth);
		}
	}
	//make legs - E

	//make body - S
	FdPoint3d p1, p2;
	p1 = p2 = p0;
	p1 += vUp * legHeight;
	p2 += vUp * (H - D / 4);
	makeVerySimpleTube(p1, p2, D, cpx);
	double latAngles[2] = { 0, 90 };
	double longAngles[2] = { 0, 360 };
	double diams[3] = { D * 0.5, D, D };
	int n[2] = { 2 * cpx, 2 * cpx };
	makeSpheroidSection(p1, vUp, vN, latAngles, longAngles, diams, n);
	makeSpheroidSection(p2, -vUp, vN, latAngles, longAngles, diams, n);
	if (strcmp(con_t, "Non-flange") == 0) {
		p1 += vUp * (H - D / 4 - legHeight) * 0.5;
		makeDonutSection(p1, vUp, vN, 0.5 * D, 0.01 * H, 360, 2 * cpx, 2 * cpx);
	}
	//make body - E


	//make top - S
	p1 = p2 = p0;
	p1 += vUp * (H - D * 0.01);
	p2 += vUp * (H * 1.015 - D * 0.01);
	makeVerySimpleTube(p1, p2, D * 0.03, cpx);
	makeFlatDisc(p1, vUp, D * 0.03, cpx);
	makeFlatDisc(p2, vUp, D * 0.03, cpx);

	p1 = p2;
	p2 += vUp * D * 0.01;
	makeVerySimpleTube(p1, p2, D * 0.02, cpx);
	makeFlatDisc(p2, vUp, D * 0.02, cpx);
	FdPoint3d centerRotatePoint = p0;
	centerRotatePoint += vUp * (H - D * 0.25);
	if (strcmp(con_t, "Non-flange") == 0) {
		FdPoint3d points[2] = { p0, p0 };
		points[0] += vUp * H;
		points[1] += vUp * H * 0.97;
		points[1] += vN * D * 0.35;
		FdVector3d vNs[2] = { vN, vN };
		FdVector3d uVs[2] = { vUp, vUp };
		double tabHeights[2] = { D * 0.22, D * 0.12 };
		double tabWidhts[2] = { D * 0.15, D * 0.15 };
		bool sides[4] = { false, false, false, false };
		double alfa = M_PI * 0.15;
		points[0].rotateBy(alfa, vCr, centerRotatePoint);
		points[1].rotateBy(alfa, vCr, centerRotatePoint);
		vNs[0].rotateBy(alfa, vCr);
		vNs[1].rotateBy(alfa, vCr);
		uVs[0].rotateBy(alfa, vCr);
		uVs[1].rotateBy(alfa, vCr);
		makeBox(1, points, vNs, uVs, tabWidhts, tabHeights, sides, true, true, 0, 0, 0);

		sides[0] = sides[1] = sides[2] = sides[3] = true;
		p1 = points[0];
		p1 += uVs[0] * tabHeights[0] * 0.5;
		makeBend2(p1, -uVs[0], vCr, sides, false, 90, 90, 0.1, D * 0.15, 0.1, 2 * cpx, 0.02 * D, 0.02 * D);
		FdPoint3d cenRotPoint = p1;
		cenRotPoint += vNs[0] * D * 0.02;
		p1.rotateBy(M_PI * 0.5, vCr, cenRotPoint);

		p2 = points[1];
		p2 += uVs[1] * tabHeights[1] * 0.5;
		double delta = (tabHeights[0] - tabHeights[1]) * 0.5 + 0.03 * H;
		makeBend2(p2, -uVs[0], -vCr, sides, false, 90, 90, 0.1, D * 0.15, 0.1, 2 * cpx, 0.02 * D + delta, 0.02 * D + delta);

		cenRotPoint = p2;
		cenRotPoint -= vNs[0] * (0.02 * D + delta);
		p2.rotateBy(M_PI * 0.5, -vCr, cenRotPoint);

		points[0] = p1;
		points[1] = p2;
		tabHeights[0] = tabHeights[1] = D * 0.03;
		tabWidhts[0] = tabWidhts[1] = 0.1;

		points[0] += vCr * D * 0.06;
		points[1] += vCr * D * 0.06;
		makeBox(1, points, vNs, uVs, tabHeights, tabWidhts, sides, true, true, 0, 0, 0);

		points[0] -= vCr * D * 0.12;
		points[1] -= vCr * D * 0.12;
		makeBox(1, points, vNs, uVs, tabHeights, tabWidhts, sides, true, true, 0, 0, 0);

		p1 = p2 = p0;
		p1 += vUp * (H - 0.25 * D);
		p2 += vUp * (H + 0.03 * D);
		p1 += vN * D * 0.1;
		p2 += vN * D * 0.1;
		FdVector3d nV = vUp;
		p1.rotateBy(alfa, vCr, centerRotatePoint);
		p2.rotateBy(alfa, vCr, centerRotatePoint);
		nV.rotateBy(alfa, vCr);
		makeVerySimpleTube(p1, p2, D * 0.04, cpx);

		p1 = p2;
		p2 += nV * D * 0.05;
		makeFlatDisc(p1, nV, D * 0.07, cpx);
		makeVerySimpleTube(p1, p2, D * 0.07, cpx);
		makeFlatDisc(p2, nV, D * 0.07, cpx);

	}
	else if (strcmp(con_t, "Flange") == 0) {
		p1 = p2 = p0;
		p1 += vUp * (H + 0.025 * D);
		p1 += vN * 0.17 * D;
		FdVector3d nV = vUp;
		p1.rotateBy(M_PI * 0.2, vCr, centerRotatePoint);
		nV.rotateBy(M_PI * 0.2, vCr);
		makeRectFace(p1, vCr, nV, D * 0.2, D * 0.08);
		p2 = p1;
		p2 += nV * 0.11 * D;
		makeFlatRing(p2, vCr, 0.04 * D, 0.08 * D, cpx);

		p1 = p2 = p0;
		p1 += vUp * (H + 0.025 * D);
		p1 -= vN * 0.17 * D;
		nV = vUp;
		p1.rotateBy(M_PI * 0.2, -vCr, centerRotatePoint);
		nV.rotateBy(M_PI * 0.2, -vCr);
		makeRectFace(p1, vCr, nV, D * 0.2, D * 0.08);
		p2 = p1;
		p2 += nV * 0.11 * D;
		makeFlatRing(p2, vCr, 0.04 * D, 0.08 * D, cpx);
	}
	//make top - E

	//make bottom - S
	if (strcmp(con_t, "Non-flange") == 0) {
		p1 = p2 = p0;
		p1 += vUp * legHeight;
		p2 += vUp * legHeight;
		p2 -= vUp * 0.25 * D;
		makeSimpleTube(p1, p2, 0.5 * D, 0.25 * D, cpx);

		p1 = p2;
		p2 -= vUp * 0.015 * D;
		makeVerySimpleTube(p1, p2, 0.3 * D, cpx);
		makeFlatDisc(p1, vUp, 0.3 * D, cpx);
		makeFlatDisc(p2, vUp, 0.3 * D, cpx);

		FdPoint3d points[2] = { p1, p2 };
		points[0] += vUp * 0.0025 * D;
		points[1] -= vUp * 0.0025 * D;
		points[0] += vN * 0.13 * D;
		points[1] += vN * 0.13 * D;
		for (int i = 0; i < 8; i++) {
			points[0].rotateBy(M_PI / 4, vUp, p1);
			points[1].rotateBy(M_PI / 4, vUp, p1);
			makeVerySimpleTube(points, 0.02 * D, cpx);
			makeFlatDisc(points[0], vUp, 0.02 * D, cpx);
			makeFlatDisc(points[1], vUp, 0.02 * D, cpx);
			makeScrew(points[1], -vUp, vN, 0.02 * D * 1.13, 0.01 * D, true, true);
		}

		p1 = p2;
		p2 -= vUp * 0.02 * D;
		makeFacettedCylinder(p1, p2, vN, d * 1.13, 0, 360, 6, true, true);

		p1 = p2;
		p2 -= vUp * 0.015 * D;
		makeVerySimpleTube(p1, p2, d, cpx);
		makeFlatDisc(p2, vUp, d, cpx);

		p1 = p2;
		p2 -= vUp * 0.015 * D;
		makeVerySimpleTube(p1, p2, d * 0.8, cpx);

		p1 = p2;
		p2 -= vUp * 0.05 * D;
		makeFlatDisc(p1, vUp, d, cpx);
		makeVerySimpleTube(p1, p2, d, cpx);

		p1 -= vUp * 0.0225 * D;
		points[0] = points[1] = p1;
		points[0] -= vN * d * 0.75;
		points[1] += vN * d * 1.25;
		makeVerySimpleTube(points, 0.35 * d, cpx);
		makeFlatDisc(points[0], vN, 0.35 * d, cpx);
		makeFlatDisc(points[1], vN, 0.35 * d, cpx);
		makeScrew(points[1], vN, vCr, 0.15 * d, 0.15 * d, true, true);


		FdPoint3d p3 = p0;
		p3 += vUp * h2;
		double dis = (p3 - p2).length();
		p3 -= vN * d;
		double tubeData[2] = { d, 2 * d };
		double interTubeData[4] = { d * 0.95, dis, d, 0 };
		double angles[2] = { 0, 0 };
		makeTubeToTubeIntersection2(p3, vN, tubeData, interTubeData, angles, 2 * cpx, false);
	}
	else if (strcmp(con_t, "Flange") == 0) {
		p1 = p2 = p0;
		p1 += vUp * legHeight;
		p2 += vUp * legHeight;
		p2 -= vUp * 0.29 * D;
		makeSimpleTube(p1, p2, 0.25 * D, 0.25 * D, cpx);

		FdPoint3d points[2];

		p1 = p2;
		p1 += vUp * 0.01 * D;
		makeFlatDisc(p1, vUp, 0.3 * D, cpx);
		makeVerySimpleTube(p1, p2, 0.3 * D, cpx);
		makeFlatDisc(p2, vUp, 0.3 * D, cpx);
		points[1] = p2;

		p1 += vUp * 0.015 * D;
		p2 += vUp * 0.015 * D;
		makeFlatDisc(p1, vUp, 0.3 * D, cpx);
		makeVerySimpleTube(p1, p2, 0.3 * D, cpx);
		makeFlatDisc(p2, vUp, 0.3 * D, cpx);
		points[0] = p1;

		points[0] += vUp * 0.0025 * D;
		points[1] -= vUp * 0.0025 * D;
		points[0] += vN * 0.13 * D;
		points[1] += vN * 0.13 * D;
		for (int i = 0; i < 8; i++) {
			points[0].rotateBy(M_PI / 4, vUp, p1);
			points[1].rotateBy(M_PI / 4, vUp, p1);
			makeVerySimpleTube(points, 0.02 * D, cpx);
			makeFlatDisc(points[0], vUp, 0.02 * D, cpx);
			makeFlatDisc(points[1], vUp, 0.02 * D, cpx);
			makeScrew(points[0], vUp, vN, 0.02 * D * 1.13, 0.01 * D, true, true);
			makeScrew(points[1], -vUp, vN, 0.02 * D * 1.13, 0.01 * D, true, true);
		}

		p1 = p2 = p0;
		p1 += vUp * legHeight;
		p2 += vUp * legHeight;
		p2 -= vUp * 0.29 * D;

		p1 = p2;
		p2 -= vUp * 0.06 * D;
		makeVerySimpleTube(p1, p2, 0.05 * D, cpx);

		p1 = p2;
		p1 += vUp * 0.0075 * D;
		makeFlatDisc(p1, vUp, 0.15 * D, cpx);
		makeVerySimpleTube(p1, p2, 0.15 * D, cpx);
		makeFlatDisc(p2, vUp, 0.15 * D, cpx);
		points[1] = p2;
		FdPoint3d p3 = p2;

		p1 += vUp * 0.01 * D;
		p2 += vUp * 0.01 * D;
		makeFlatDisc(p1, vUp, 0.15 * D, cpx);
		makeVerySimpleTube(p1, p2, 0.15 * D, cpx);
		makeFlatDisc(p2, vUp, 0.15 * D, cpx);
		points[0] = p1;

		points[0] += vUp * 0.0025 * D;
		points[1] -= vUp * 0.0025 * D;
		points[0] += vN * 0.065 * D;
		points[1] += vN * 0.065 * D;
		for (int i = 0; i < 4; i++) {
			points[0].rotateBy(M_PI / 2, vUp, p1);
			points[1].rotateBy(M_PI / 2, vUp, p1);
			makeVerySimpleTube(points, 0.015 * D, cpx);
			makeFlatDisc(points[0], vUp, 0.015 * D, cpx);
			makeFlatDisc(points[1], vUp, 0.015 * D, cpx);
			makeScrew(points[0], vUp, vN, 0.015 * D * 1.13, 0.0075 * D, true, true);
			makeScrew(points[1], -vUp, vN, 0.015 * D * 1.13, 0.0075 * D, true, true);
		}

		p1 = p0;
		p1 += vUp * h2;
		p1 -= vN * 0.065 * D;
		double dis = (p3 - p1).length();
		double tubeData[2] = { 0.5 * d, 0.13 * D };
		double interTubeData[4] = { 0.05 * D, dis, 0.065 * D, 0 };
		double angles[2] = { 0, 0 };
		makeTubeToTubeIntersection2(p1, vN, tubeData, interTubeData, angles, 2 * cpx, false);


		points[0] = points[1] = p1;
		points[1] += vN * 0.015 * D;
		FdPoint3d centerRotatePoint = p0;
		centerRotatePoint += vUp * h2;
		for (int i = 0; i < 2; i++) {
			points[0].rotateBy(M_PI, vUp, centerRotatePoint);
			points[1].rotateBy(M_PI, vUp, centerRotatePoint);
			makeVerySimpleTube(points, d, cpx);
			makeFlatRing(points[0], vN, 0.5 * d, d, cpx);
			makeFlatRing(points[1], vN, 0.5 * d, d, cpx);

			for (int j = 0; j < 2; j++) {
				FdPoint3d symPoint = points[j];
				symPoint += vUp * 0.35 * d;
				symPoint.rotateBy(M_PI * 0.25, vN, centerRotatePoint);
				for (int k = 0; k < 4; k++) {
					symPoint.rotateBy(M_PI * 0.5, vN, centerRotatePoint);
					makeSymbolicCircle(symPoint, vN, 0.1 * d);
				}
			}

		}
	}
	//make bottom -E
	return 0;
}

//short CGeneralBlockCreator::makeValveTASDp()
//{
//	ads_real d; get_val("d", d); //diameter = 50
//	ads_real L; get_val("L", L); //Lenght = 240;
//	ads_real H; get_val("H", H); //Height = 200;
//	ads_real W; get_val("W", W); // Width = 97;
//	int n = 10;
//
//
//
//	// makeRightTube
//
//
//	FdPoint3d fr1(0, 0, 0);
//	FdPoint3d
//		fr2(L / 2 - 5, 0, 0),
//		fr3(L / 2 + 5, 0, 0),
//		fr4(L / 2 - d / 12 - 10, d / 10 + d / 2 - 1, 0);
//
//	FdPoint3d fr[2] = { fr2, fr3 };
//	double mainTube1[2] = { d, L / 2 - 5 };
//	double interTube1[4] = { d / 6, d / 10 + d / 2, L / 2 - d / 12 - 10, 0 };
//	double angles1[2] = { 0, 270 };
//	double hypo1 = H / 4 + d / 2;
//	double x = 25 * hypo1 / 86;
//	FdPoint3d fru1(x, H / 8 - d / 4, 0);
//	FdVector3d vector1(5, 8.6, 0);
//	vector1.normalize();
//	makeDisc(fru1, vector1, d, hypo1 * 100 / 86, n, false);
//	makeTubeToTubeIntersection2(fr1, vx, mainTube1, interTube1, angles1, n, false);
//	makeVerySimpleTube(fr, d + 10, n);
//	makeFlatDisc(fr2, vx, d + 10, n);
//	makeFlatDisc(fr3, vx, d + 10, n);
//	makeScrew(fr4, vy, vx, d / 6, d / 10, true, true);
//
//	//makeLeftTube
//
//
//
//	double Ll = L / 2 - 10;
//	FdPoint3d fl1(-Ll / 2, 0, 0),
//		fl2(-Ll, 0, 0),
//		fl3(-Ll - 10, 0, 0);
//	FdPoint3d fl[2] = { fl2, fl3 };
//	double mainTube2[2] = { d, Ll / 2 + 2 };
//	double interTube2[4] = { d / 3, d , Ll / 2 - d / 4 - 5, 0 };
//	double angles2[2] = { 0, 90 };
//	makeTubeToTubeIntersection2(fl1, vx, mainTube2, interTube2, angles1, n, false);
//	makeTubeToTubeIntersection2(fl1, -vx, mainTube2, interTube2, angles2, n, false);
//	makeVerySimpleTube(fl, d + 10, n);
//	makeFlatDisc(fl2, vx, d + 10, n);
//	makeFlatDisc(fl3, vx, d + 10, n);
//	FdPoint3d center(-Ll / 2, d, 0),
//		size(Ll - 10, d / 2 + 2, d / 3 + 2);
//	setMeshColor(32, 32, 32);
//	//makeSimpleBox(center, size);
//
//	//makeUpperLeft
//
//	int count = 2;
//	FdPoint3d fu1(-Ll, d + 3 * H / 50, 0),
//		fu2(-15 * H / 430, d + 3 * H / 50, 0),
//		fu3(15 * H / 860, d + 3 * H / 100, 0);
//	FdVector3d vector2(8.6, -5, 0);
//	vector2.normalize();
//	FdVector3d vector3(8.6, 5, 0);
//	vector3.normalize();
//	FdPoint3d centralP1[3] = { fu1, fu2, fu3 };
//	FdVector3d vector[3] = { vx, vector3, vector2 };
//	bool sides[8] = { true, true, true, true, true, true, true, true };
//	bool conector[2] = { false, false };
//	double width1[3] = { W, W, W };
//	double height1[3] = { 3 * H / 25, 60 * H / 430, 30 * H / 430 };
//	makeBox(count, centralP1, vector, width1, height1, sides, conector, true, true);
//	FdPoint3d fu7(-Ll, d + 3 * H / 25 + H / 25, 0),
//		fu8(-30 * H / 430 - H / 43, d + 4 * H / 25, 0),
//		fu9(30 * H / 860 + H / 86, d + 4 * H / 50, 0);
//	FdPoint3d centralP3[3] = { fu7, fu8, fu9 };
//	double height3[3] = { 2 * H / 25, 40 * H / 430, 20 * H / 430 };
//	setMeshColor(204, 0, 0);
//	makeBox(count, centralP3, vector, width1, height3, sides, conector, true, true);
//	FdPoint3d fu4(-Ll, d + H / 5 + H / 50, 0),
//		fu5(-50 * H / 430 - 5 * H / 430, d + H / 5 + H / 50, 0),
//		fu6(50 * H / 860 + 5 * H / 860, d + H / 10 + H / 100, 0);
//	FdPoint3d centralP2[3] = { fu4, fu5, fu6 };
//	double width2[3] = { W - 20, W - 20, W - 20 };
//	double height2[3] = { H / 25, 20 * H / 430, 10 * H / 430 };
//	makeBox(count, centralP2, vector, width2, height2, sides, conector, true, true);
//	setMeshColor(0);
//
//	//makeUpperright
//
//
//
//	double hypo2 = 50 * H / 2064;
//	double hypo3 = 2 * hypo2;
//	double hypo4 = 3 * hypo2;
//	FdPoint3d fm1(2 * x, H / 4, 0),
//		fm2(2 * x + hypo2 / 2, H / 4 + H / 48, 0),
//		fm3(2 * x + hypo2 / 2 + hypo3 / 2, H / 4 + H / 48 + H / 24, 0),
//		fm4(2 * x + hypo2 / 2 + hypo3, H / 4 + H / 48 + H / 12, 0),
//		fm5(2 * x + hypo2 / 2 + hypo3 + hypo3 / 2, H / 4 + H / 48 + H / 12 + H / 24, 0),
//		fm6(2 * x + hypo2 / 2 + hypo3 + hypo3, H / 4 + H / 48 + H / 6, 0),
//		fm7(2 * x + hypo2 / 2 + hypo3 + hypo3 + 2 * hypo4, H / 4 + H / 48 + H / 6 + H / 4, 0);
//	makeVerySimpleTube(fm1, fm2, d + 10, n);
//	makeFlatDisc(fm1, vector1, d + 10, n);
//	makeFlatDisc(fm2, vector1, d + 10, n);
//	makeScrew(fm2, vector1, vy, d + 10, hypo3, true, true);
//	makeVerySimpleTube(fm3, fm4, d - 3, n);
//	makeFlatDisc(fm3, vector1, d - 3, n);
//	makeFlatDisc(fm4, vector1, d - 3, n);
//	makeVerySimpleTube(fm4, fm5, d - 7, n);
//	makeFlatDisc(fm4, vector1, d - 7, n);
//	makeFlatDisc(fm5, vector1, d - 7, n);
//	setMeshColor(96, 96, 96);
//	ads_real D = H / 8;
//	makeVerySimpleTube(fm5, fm6, D + 10, n);
//	makeFlatDisc(fm5, vector1, D + 10, n);
//	makeFlatDisc(fm6, vector1, D + 10, n);
//	setMeshColor(255, 255, 255);
//	makeVerySimpleTube(fm6, fm7, D, n);
//	double hypo5 = 100 * H / 344;
//	FdPoint3d fm8(2 * x + hypo2 / 2 + 2 * hypo3 + hypo4 + hypo4 / 2 + hypo5 / 4 + hypo5 / 16 - 258 * D / 100, H / 8 + H / 2 + H / 8 + H / 32 + 3 * D / 2, 0),
//		fm9(2 * x + hypo2 / 2 + 2 * hypo3 + hypo4 + hypo4 / 2 + hypo5 / 4 + hypo5 / 16 + 86 * D / 100, H / 8 + H / 2 + H / 8 + H / 32 - D / 2, 0),
//		fm10(2 * x + hypo2 / 2 + 2 * hypo3 + hypo4 + hypo4 / 2 + hypo5 / 16 - 258 * D / 100, H / 8 + H / 2 + H / 32 + 3 * D / 2, 0),
//		fm11(2 * x + hypo2 / 2 + 2 * hypo3 + hypo4 + hypo4 / 2 + hypo5 / 16 + 86 * D / 100 + 1, H / 8 + H / 2 + H / 32 - D / 2 - 1, 0),
//		fm12(2 * x + hypo2 / 2 + 2 * hypo3 + hypo4 + hypo4 / 2 + hypo5 / 16 - 86 * D / 100, H / 8 + H / 2 + H / 32 + D / 2, 0);
//	bool side2[4] = { true, true, true, true };
//	double width4[2] = { 2 * D, 2 * D };
//	double height4[2] = { 3 * hypo5 / 4, 3 * hypo5 / 4 };
//	double width5[2] = { 2 * D + 2, 2 * D + 2 };
//	double height5[2] = { hypo5 / 4, hypo5 / 2 };
//	double width6[2] = { 2 * D - 1, 2 * D - 1 };
//	double height6[2] = { hypo5 / 4,   hypo5 };
//	FdVector3d vectorur1[2] = { vector2, vector2 };
//	FdVector3d vectorur2[2] = { vector2, FdVector3d(0, -1, 0).normalize() };
//	FdPoint3d fur1[2] = { fm8, fm9 };
//	FdPoint3d fur2[2] = { fm10, fm11 };
//	FdPoint3d fur3[2] = { fm10, fm12 };
//	makeBox(1, fur1, vectorur1, width4, height4, side2, conector, true, true);
//	setMeshColor(96, 96, 96);
//	makeBox(1, fur2, vectorur1, width5, height5, side2, conector, true, true);
//	makeBox(1, fur3, vectorur2, width6, height6, side2, conector, true, true);
//	return 0;
//}

short CGeneralBlockCreator::makeAntiCVEA453()
{
	ads_real D = 200;  get_val("L", D);
	ads_real B = 165;  get_val("W", B);
	ads_real A = 50;	 get_val("d", A);


	setMeshColor(3, 28, 252);
	FdPoint3d startPoint, endPoint;
	startPoint.set(0, 0, 0);
	endPoint.set(0, D / 14, 0);
	makeFacettedCylinder(startPoint, endPoint, vz, B, 0, 360, 4 * cpx, false, false);
	makeFlatRing(startPoint, vy, A, B, 4 * cpx);
	makeFlatRing(endPoint, vy, A, B, 4 * cpx);

	startPoint = endPoint;
	endPoint.y += D / 10;
	FdPoint3d cp[] = { startPoint,endPoint };
	makeVerySimpleTube(cp, A, 4 * cpx);

	startPoint = endPoint;
	endPoint.y += D / 10;
	makeFacettedCylinder(startPoint, endPoint, vz, 1.2 * A, 0, 360, 4 * cpx, false, false);

	startPoint = endPoint;
	endPoint.y += D / 14.2;
	FdPoint3d cp2[] = { startPoint,endPoint };
	makeSimpleTube(cp2, 1.2 * A, 1.25 * A, 4 * cpx);

	startPoint = endPoint;
	endPoint.y += D / 14.2;
	FdPoint3d cp3[] = { startPoint,endPoint };
	makeSimpleTube(cp3, 1.25 * A, 1.9 * A, 4 * cpx);

	startPoint = endPoint;
	endPoint.y += D / 14.2;
	FdPoint3d cp4[] = { startPoint,endPoint };
	makeSimpleTube(cp4, 1.9 * A, 2.25 * A, 4 * cpx);

	startPoint = endPoint;
	endPoint.y += D / 14.2;
	FdPoint3d cp5[] = { startPoint,endPoint };
	makeSimpleTube(cp5, 2.25 * A, 2.35 * A, 4 * cpx);


	//A value
	FdPoint3d startPointB, endPointB;
	startPointB.y = endPoint.y;
	startPointB.z = -D / 4;
	endPointB = startPointB;
	endPointB.z = -D / 4.4;
	makeFacettedCylinder(startPointB, endPointB, vy, A / 2, 0, 360, 4 * cpx, true, true);
	setMeshColor(0);
	startPointB.z = endPointB.z;
	endPointB.z -= D / 40;
	makeFacettedCylinder(startPointB, endPointB, vy, A / 2.5, 0, 360, 6, true, true);

	//make top things
	FdPoint3d startPointT, endPointT;
	startPointT = endPoint;
	startPointT.z = D / 6.6;
	//startPointT.y-= A
	endPointT = startPointT;
	endPointT.z = D / 4;
	makeVerySimpleTube(startPointT, endPointT, 2 * A, 4 * cpx);
	makeFlatDisc(startPointT, vz, 2 * A, 4 * cpx);
	makeFlatDisc(endPointT, vz, 2 * A, 4 * cpx);

	int n[2] = { cpx,4 * cpx };
	double lattAngles[2] = { 90,180 };
	double longAngles[2] = { 0,360 };
	double axisLenght[3] = { 0.3 * A, 1.6 * A, 1.6 * A };
	makeSpheroidSection(endPointT, vz, lattAngles, longAngles, axisLenght, n);

	double dis1 = D / 4 - D / 6.6;
	startPointT.z = D / 6.6 + dis1 / 2 - 0.75 * dis1;
	endPointT.z = startPointT.z;
	startPointT.x = startPointT.x + A + 0.35 * A;
	endPointT.x = endPointT.x - A - 0.35 * A;
	makeScrew(startPointT, vz, vx, 0.3 * A, 1.5 * dis1, true, true);
	makeScrew(endPointT, vz, vx, 0.3 * A, 1.5 * dis1, true, true);
	startPointT.z = D / 6.6 + dis1 / 2;
	endPointT.z = startPointT.z;
	startPointT.x = 0;
	endPointT.x = A + 0.5 * A;
	double heightbox[2] = { dis1, dis1 };
	double widthbox[2] = { 2 * A , A };
	bool side[4] = { true, true, true, true };
	FdPoint3d box1[2] = { startPointT, endPointT };
	bool connectorbox[2] = { false, false };
	makeBox(1, box1, heightbox, widthbox, side, connectorbox, true, true);
	endPointT.x = -A - 0.5 * A;
	FdPoint3d box2[2] = { startPointT, endPointT };
	makeBox(1, box2, heightbox, widthbox, side, connectorbox, true, true);

	endPointT.x = 0;
	startPointT.z = D / 4;
	endPointT.z = startPointT.z + dis1;
	makeVerySimpleTube(startPointT, endPointT, 0.4 * A, 4 * cpx);
	makeScrew(endPointT, vz, vx, 0.5 * A, dis1, true, true);
	startPointT.z = endPointT.z - dis1 / 4;
	endPointT.z = startPointT.z;
	endPointT.y = startPointT.y + dis1 / 2 + 0.2 * A;
	double heightbox2[2] = { dis1 / 2, dis1 / 2 };
	double widthbox2[2] = { 0.3 * A , 0.3 * A };
	FdPoint3d box3[2] = { startPointT, endPointT };
	makeBox(1, box3, heightbox2, widthbox2, side, connectorbox, true, true);
	startPointT.y = endPointT.y;
	startPointT.x += 0.15 * A;
	endPointT.x += -0.3 * A - 0.3 * A;
	double heightbox3[2] = { dis1 / 2, dis1 / 2 };
	double widthbox3[2] = { 0.2 * A , 0.4 * A };
	FdPoint3d box4[2] = { startPointT, endPointT };
	makeBox(1, box4, heightbox3, widthbox3, side, connectorbox, true, true);


	startPointT.x = 0;
	endPointT.x = 0;
	startPointT.y = D / 14 + 0.3 * A;
	endPointT.y = startPointT.y;
	startPointT.z = D / 4;
	endPointT.z = startPointT.z + dis1;
	makeVerySimpleTube(startPointT, endPointT, 0.4 * A, 4 * cpx);
	makeScrew(endPointT, vz, vx, 0.5 * A, dis1, true, true);
	startPointT.z = endPointT.z - dis1 / 4;
	endPointT.z = startPointT.z;
	endPointT.y = startPointT.y + dis1 / 2 + 0.2 * A;
	FdPoint3d box5[2] = { startPointT, endPointT };
	makeBox(1, box5, heightbox2, widthbox2, side, connectorbox, true, true);
	startPointT.y = endPointT.y;
	startPointT.x += 0.15 * A;
	endPointT.x += -0.3 * A - 0.3 * A;
	FdPoint3d box6[2] = { startPointT, endPointT };
	makeBox(1, box6, heightbox3, widthbox3, side, connectorbox, true, true);




	setMeshColor(3, 28, 252);
	startPointT.x = 0;
	endPointT.x = 0;
	startPointT.y = D / 14 + 0.3 * A;
	endPointT.y = startPointT.y;
	startPointT.z = D / 4;
	endPointT.z = 0;
	makeVerySimpleTube(startPointT, endPointT, 0.6 * A, 4 * cpx);
	makeFlatDisc(startPointT, vz, 0.6 * A, 4 * cpx);

	startPoint = endPoint;
	endPoint.y += D / 14.2;
	FdPoint3d cp6[] = { startPoint,endPoint };
	makeSimpleTube(cp6, 2.35 * A, 2.25 * A, 4 * cpx);

	FdPoint3d startPointM, endPointM;
	startPointM.y = endPoint.y;
	startPointM.x = D / 5.7;
	endPointM = startPointM;
	endPointM.x = D / 3.3;
	double height[2] = { A,A };
	double width[2] = { 0.8 * A, 0.8 * A };
	FdPoint3d cpB[] = { startPointM,endPointM };
	bool sides[4] = { true,true,true,true };
	bool connector[2] = { false,false };
	makeBox(1, cpB, width, height, sides, connector, true, true);

	setMeshColor(235, 235, 240);
	endPointM.x += D / 400;
	double height2[2] = { 0.8 * A,0.8 * A };
	double width2[2] = { 0.6 * A, 0.6 * A };
	FdPoint3d cpB2[] = { startPointM,endPointM };
	makeBox(1, cpB2, width2, height2, sides, connector, true, true);
	setMeshColor(0);


	startPointM.y = endPoint.y;
	startPointM.x = -D / 5.7;
	endPointM = startPointM;
	endPointM.x = -D / 3.3;
	FdPoint3d cpB3[] = { startPointM,endPointM };
	makeBox(1, cpB3, width, height, sides, connector, true, true);

	setMeshColor(235, 235, 240);
	endPointM.x -= D / 400;
	FdPoint3d cpB4[] = { startPointM,endPointM };
	makeBox(1, cpB4, width2, height2, sides, connector, true, true);
	setMeshColor(0);
	//A value


	setMeshColor(3, 28, 252);
	startPoint = endPoint;
	endPoint.y += D / 14.2;
	FdPoint3d cp7[] = { startPoint,endPoint };
	makeSimpleTube(cp7, 2.25 * A, 2.1 * A, 4 * cpx);

	startPoint = endPoint;
	endPoint.y += D / 2.8 - D / 5.5;
	FdPoint3d cp8[] = { startPoint,endPoint };
	makeSimpleTube(cp8, 2.1 * A, 1.2 * A, 4 * cpx);

	startPoint = endPoint;
	endPoint.y += D / 42;
	FdPoint3d cp9[] = { startPoint,endPoint };
	makeSimpleTube(cp9, 1.2 * A, A, 4 * cpx);

	startPoint = endPoint;
	endPoint.y += D / 12;
	makeFacettedCylinder(startPoint, endPoint, vz, A, 0, 360, 4 * cpx, false, false);

	startPoint = endPoint;
	endPoint.y += D / 14;
	makeFacettedCylinder(startPoint, endPoint, vz, B, 0, 360, 4 * cpx, false, false);
	makeFlatRing(startPoint, vy, A, B, 4 * cpx);
	makeFlatRing(endPoint, vy, A, B, 4 * cpx);
	setMeshColor(0);
	return 0;
}

short CGeneralBlockCreator::makeWashingMashineTop()
{

	//Washmachinetop

	ads_real H = 853; get_val("H", H); //Height = 853;
	ads_real W = 397; get_val("W", W); //Width = 397;
	ads_real L = 600; get_val("L", L); //Length = 600;
	ads_real d1 = 25; get_val("d1", d1); //Cole water connector = 25;
	ads_real d2 = 15; get_val("d2", d2); // Sewage connector = 15;

	//main
	FdPoint3d startP(0, 0, 0),
		endP(0, 0, 0);
	startP.y = L / 2 + 7 * L / 240;
	endP.y = startP.y;
	endP.z = H - H / 10;
	double width1[2] = { W, W };
	double height1[2] = { L - 7 * L / 120, L - 7 * L / 120 };
	FdPoint3d box1[2] = { startP, endP };
	makeBox(1, box1, height1, width1, false);
	makeRectFace(startP, vz, vy, L - 7 * L / 120, W);
	makeRectFace(endP, vz, vy, L - 7 * L / 120, W);
	startP.y = 7 * L / 240;
	endP.y = startP.y;
	startP.z = H / 5;
	double height2[2] = { 1.414 * 7 * L / 120, 7 * L / 120 };
	FdVector3d vt1(0, 2, 2);
	vt1.normalize();
	FdPoint3d box2[2] = { startP, endP };
	bool side1[4] = { true, true, true, true };
	bool connector[2] = { false, false };
	FdVector3d vt[2] = { vt1,  vz };
	FdVector3d vt5[2] = { vx,  vx };
	makeBox(1, box2, vt, vt5, height2, width1, side1, true, true, 0, 0, 0);

	//bot
	FdPoint3d sp, ep;
	sp.x = W / 2 - 15 * W / 200;
	sp.y = 7 * L / 120 + L / 12;
	ep.z = -H / 100;
	ep.x = sp.x;
	ep.y = sp.y;
	makeVerySimpleTube(sp, ep, W / 10, 4 * cpx);
	makeFlatDisc(ep, vz, W / 10, 4 * cpx);

	sp.x = -W / 2 + 15 * W / 200;
	ep.x = sp.x;
	ep.y = sp.y;
	makeVerySimpleTube(sp, ep, W / 10, 4 * cpx);
	makeFlatDisc(ep, vz, W / 10, 4 * cpx);

	sp.y = L - L / 12;
	ep.x = sp.x;
	ep.y = sp.y;
	makeVerySimpleTube(sp, ep, W / 10, 4 * cpx);
	makeFlatDisc(ep, vz, W / 10, 4 * cpx);

	sp.x = W / 2 - 15 * W / 200;
	ep.x = sp.x;
	ep.y = sp.y;
	makeVerySimpleTube(sp, ep, W / 10, 4 * cpx);
	makeFlatDisc(ep, vz, W / 10, 4 * cpx);

	//top
	startP.y = L / 2 - L / 50;
	startP.x = 0;
	endP.y = startP.y;
	startP.z = endP.z;
	endP.z = H - H / 10 + H / 40;
	double height3[2] = { L - L / 25, L - L / 25 };
	FdPoint3d box3[2] = { startP, endP };
	makeBox(1, box3, height3, width1, false);
	makeRectFace(endP, vz, vy, L - L / 25, W);
	startP.z = endP.z;
	endP.z = H - H / 40;
	startP.y = L - L / 40;
	endP.y = startP.y;
	bool side2[4] = { true, false, true, true };
	FdPoint3d box4[2] = { startP, endP };
	double width2[2] = { W / 5, W / 5 };
	double height4[2] = { L / 20, L / 20 };
	makeBox(1, box4, height4, width2, side2, connector, true, true);
	makeRectFace(startP, vz, vy, L / 20, W);
	startP.x = W / 4 + W / 20;
	endP.x = startP.x;
	double width3[2] = { W / 2 - W / 10, W / 2 - W / 10 };
	FdPoint3d box5[2] = { startP, endP };
	makeBox(1, box5, height4, width3, false);
	startP.x = -W / 4 - W / 20;
	endP.x = startP.x;
	FdPoint3d box6[2] = { startP, endP };
	makeBox(1, box6, height4, width3, false);
	startP.x = 0;
	endP.x = 0;
	startP.y = L / 2 - L / 40;
	endP.y = startP.y;
	double height5[2] = { L - L / 20, L - L / 20 };
	FdPoint3d box7[2] = { startP, endP };
	makeBox(1, box7, height5, width1, false);
	startP.y = L / 2;
	endP.y = startP.y;
	startP.z = endP.z;
	endP.z = H;
	FdPoint3d box8[2] = { startP, endP };
	double height6[2] = { L, L };
	makeBox(1, box8, height6, width1, false);
	makeRectFace(startP, vz, vy, L, W);
	makeRectFace(endP, vz, vy, L, W);

	//remote

	startP.z = endP.z;
	endP.z = H + H / 40;
	startP.y = L / 10;
	endP.y = startP.y;
	double h = sqrt(H * H / 400 + L * L / 25);
	double height7[2] = { L / 5, h };
	FdVector3d vt2(0, H / 20, L / 5);
	vt2.normalize();
	FdPoint3d box9[2] = { startP, endP };
	FdVector3d vector[2] = { vz, vt2 };
	makeBox(1, box9, vector, vt5, height7, width1, side1, true, true, 0, 0, 0);
	startP.z = endP.z;
	startP.x = -W / 3;
	endP.x = startP.x;
	endP.z += H / 40;
	FdPoint3d tube[2] = { startP, endP };
	double dia[2][2] = { h / 2, h / 2 , h / 2, h / 2 };
	FdVector3d vt3[2] = { vt2, vt2 };
	makeTube(tube, vt3, dia, 4 * cpx, 1, false, false);
	makeFlatDisc(endP, vt2, h / 2, 4 * cpx);

	//hose

	startP.y = 0;
	startP.z = 15 * H / 17;
	startP.x = -W / 2 + 3 * W / 8;
	endP.x = startP.x;
	endP.z = startP.z;
	endP.y = startP.y - L / 50;
	makeVerySimpleTube(startP, endP, 2 * d1, 4 * cpx);
	makeVerySimpleTube(startP, endP, d1, 4 * cpx);
	makeFlatRing(endP, vy, d1, 2 * d1, 4 * cpx);
	startP.y = endP.y - L / 10;
	FdPoint3d sp2, ep2;
	sp2.x = endP.x;
	sp2.y = endP.y;
	sp2.z = startP.z - L / 10;
	makeTubularBend(sp2, vx, vz, L / 10, d1, 90, 4 * cpx, 20, true, false);
	startP.z = endP.z - L / 10;
	endP.z = startP.z - H / 3;
	endP.y = startP.y;
	makeVerySimpleTube(startP, endP, d1, 4 * cpx);
	startP.z = endP.z;
	endP.z = endP.z + H / 30;
	makeVerySimpleTube(startP, endP, d1, 4 * cpx);
	makeVerySimpleTube(startP, endP, d1 + d1 / 2, 4 * cpx);
	makeFlatRing(startP, vz, d1, d1 + d1 / 2, 4 * cpx);
	makeFlatRing(endP, vz, d1, d1 + d1 / 2, 4 * cpx);


	startP.y = 7 * L / 120;
	startP.z = 60 * H / 853;
	startP.x = -W / 2 + 138 * W / 397;
	endP.x = startP.x;
	endP.z = startP.z;
	endP.y = startP.y - L / 50;
	makeVerySimpleTube(startP, endP, 2 * d2, 4 * cpx);
	makeVerySimpleTube(startP, endP, d2, 4 * cpx);
	makeFlatRing(endP, vy, d2, 2 * d2, 4 * cpx);
	startP.y = endP.y - L / 10;
	sp2.z = endP.z;
	sp2.y = endP.y;
	sp2.x = startP.x + L / 10;
	makeTubularBend(sp2, -vz, -vy, L / 10, d2, 90, 4 * cpx, 20, true, false);
	startP.x = sp2.x;
	endP.x = startP.x + H / 3;
	endP.y = startP.y;
	makeVerySimpleTube(startP, endP, d2, 4 * cpx);
	startP.x = endP.x;
	endP.x = endP.x + H / 30;
	makeVerySimpleTube(startP, endP, d2, 4 * cpx);
	makeVerySimpleTube(startP, endP, d2 + d2 / 2, 4 * cpx);
	makeFlatRing(startP, vx, d2, d2 + d2 / 2, 4 * cpx);
	makeFlatRing(endP, vx, d2, d2 + d2 / 2, 4 * cpx);

	startP.y = 7 * L / 120;
	startP.z = 90 * H / 853;
	startP.x = W / 2 - 154 * W / 397;
	endP.x = startP.x;
	endP.z = startP.z;
	endP.y = startP.y - L / 50;
	makeVerySimpleTube(startP, endP, W / 32, 4 * cpx);
	makeVerySimpleTube(startP, endP, W / 64, 4 * cpx);
	makeFlatRing(endP, vy, W / 64, W / 32, 4 * cpx);
	startP.y = endP.y - L / 20;
	sp2.z = endP.z;
	sp2.y = endP.y;
	sp2.x = startP.x + L / 20;
	makeTubularBend(sp2, -vz, -vy, L / 20, W / 64, 90, 4 * cpx, 20, true, false);
	startP.x = sp2.x;
	endP.x = startP.x + H / 3;
	endP.y = startP.y;
	makeVerySimpleTube(startP, endP, W / 64, 4 * cpx);
	startP.x = endP.x;
	endP.x = endP.x + H / 30;
	makeVerySimpleTube(startP, endP, W / 64, 4 * cpx);
	makeVerySimpleTube(startP, endP, W / 64 + W / 64, 4 * cpx);
	makeFlatRing(startP, vx, W / 64, W / 64 + W / 64, 4 * cpx);
	makeFlatRing(endP, vx, W / 64, W / 64 + W / 64, 4 * cpx);

	// topgate
	sp.z = H + 1;
	sp2.z = H + 1;
	sp.y = L / 5 + L / 10;
	sp2.y = L / 5 + L / 10;
	sp.x = -W / 2 + W / 10;
	sp2.x = W / 2 - W / 10;
	ep2.z = H + 1;
	ep2.x = W / 2 - W / 10;
	ep2.y = L - L / 10;
	ep.z = H + 1;
	ep.x = -W / 2 + W / 10;
	ep.y = L - L / 10;
	makeSymbolicLine(sp, sp2);
	makeSymbolicLine(sp, ep);
	makeSymbolicLine(sp2, ep2);
	makeSymbolicLine(ep, ep2);
	return 0;
}

short CGeneralBlockCreator::makeReflexG400()
{
	// make tankB
	ads_real D = 740; get_val("D", D); //diameter = 740;
	ads_real H = 1373; get_val("H", H); // height = 1373;
	ads_real d = 25; get_val("d", d); //Connector = 25;
	ads_real h2 = 0.1 * H; get_val("H2", h2);
	char* con_t;	get_val("con_t", con_t);
	FdVector3d vUp(vz), vN(vx);
	FdVector3d vCr = vUp.crossProduct(vN);
	FdPoint3d p0 = FdPoint3d(0, 0, 0);

	//make legs - S
	double legWidth = 0.1 * D;
	double legHeight;
	if (strcmp(con_t, "Non-flange") == 0) {
		legHeight = 0.3 * H;
		FdPoint3d points[2] = { p0, p0 };
		points[0] += vCr * 0.4 * D;
		points[1] += vCr * 0.4 * D;
		points[1] += vUp * legHeight;
		FdVector3d nVs[2] = { vUp, vUp };
		FdVector3d uVs[2] = { vCr, vCr };
		double tabHeights[2] = { legWidth, legWidth };
		double tabWidths[2] = { legWidth, legWidth };
		bool sides[4] = { false, true, true, true };
		for (int i = 0; i < 3; i++) {
			points[0].rotateBy(M_PI * 2 / 3, vUp, p0);
			points[1].rotateBy(M_PI * 2 / 3, vUp, p0);
			uVs[0].rotateBy(M_PI * 2 / 3, vUp);
			uVs[1].rotateBy(M_PI * 2 / 3, vUp);
			makeBox(1, points, nVs, uVs, tabWidths, tabHeights, sides, true, true, 0, 0, 0);
		}

	}
	else if (strcmp(con_t, "Flange") == 0) {
		legHeight = 0.35 * H;
		FdPoint3d points[2] = { p0, p0 };
		points[0] += vCr * 0.4 * D;
		points[1] += vCr * 0.4 * D;
		points[1] += vUp * legHeight;
		FdVector3d nVs[2] = { vUp, vUp };
		FdVector3d uVs[2] = { vCr, vCr };
		double tabHeights[2] = { legWidth, legWidth };
		double tabWidths[2] = { legWidth, legWidth };
		bool sides[4] = { false, true, true, true };
		for (int i = 0; i < 3; i++) {
			points[0].rotateBy(M_PI * 2 / 3, vUp, p0);
			points[1].rotateBy(M_PI * 2 / 3, vUp, p0);
			uVs[0].rotateBy(M_PI * 2 / 3, vUp);
			uVs[1].rotateBy(M_PI * 2 / 3, vUp);
			makeBox(1, points, nVs, uVs, tabWidths, tabHeights, sides, true, true, 0, 0, 0);

			makeFlatDisc(points[0], vUp, legWidth * 1.5, cpx);
		}

	}
	//make legs - E

	//make body - S
	FdPoint3d p1, p2;
	p1 = p2 = p0;
	p1 += vUp * legHeight;
	p2 += vUp * (H - D / 4);
	makeVerySimpleTube(p1, p2, D, cpx);
	double latAngles[2] = { 0, 90 };
	double longAngles[2] = { 0, 360 };
	double diams[3] = { D * 0.5, D, D };
	int n[2] = { 2 * cpx, 2 * cpx };
	makeSpheroidSection(p1, vUp, vN, latAngles, longAngles, diams, n);
	makeSpheroidSection(p2, -vUp, vN, latAngles, longAngles, diams, n);
	if (strcmp(con_t, "Non-flange") == 0) {
		p1 += vUp * (H - D / 4 - legHeight) * 0.5;
		makeDonutSection(p1, vUp, vN, 0.5 * D, 0.01 * H, 360, 2 * cpx, 2 * cpx);
	}
	//make body - E


	//make top - S
	p1 = p2 = p0;
	p1 += vUp * (H - D * 0.01);
	p2 += vUp * (H * 1.015 - D * 0.01);
	makeVerySimpleTube(p1, p2, D * 0.03, cpx);
	makeFlatDisc(p1, vUp, D * 0.03, cpx);
	makeFlatDisc(p2, vUp, D * 0.03, cpx);

	p1 = p2;
	p2 += vUp * D * 0.01;
	makeVerySimpleTube(p1, p2, D * 0.02, cpx);
	makeFlatDisc(p2, vUp, D * 0.02, cpx);
	FdPoint3d centerRotatePoint = p0;
	centerRotatePoint += vUp * (H - D * 0.25);
	if (strcmp(con_t, "Non-flange") == 0) {
		FdPoint3d points[2] = { p0, p0 };
		points[0] += vUp * H;
		points[1] += vUp * H * 0.97;
		points[1] += vN * D * 0.35;
		FdVector3d vNs[2] = { vN, vN };
		FdVector3d uVs[2] = { vUp, vUp };
		double tabHeights[2] = { D * 0.22, D * 0.12 };
		double tabWidhts[2] = { D * 0.15, D * 0.15 };
		bool sides[4] = { false, false, false, false };
		double alfa = M_PI * 0.15;
		points[0].rotateBy(alfa, vCr, centerRotatePoint);
		points[1].rotateBy(alfa, vCr, centerRotatePoint);
		vNs[0].rotateBy(alfa, vCr);
		vNs[1].rotateBy(alfa, vCr);
		uVs[0].rotateBy(alfa, vCr);
		uVs[1].rotateBy(alfa, vCr);
		makeBox(1, points, vNs, uVs, tabWidhts, tabHeights, sides, true, true, 0, 0, 0);

		sides[0] = sides[1] = sides[2] = sides[3] = true;
		p1 = points[0];
		p1 += uVs[0] * tabHeights[0] * 0.5;
		makeBend2(p1, -uVs[0], vCr, sides, false, 90, 90, 0.1, D * 0.15, 0.1, 2 * cpx, 0.02 * D, 0.02 * D);
		FdPoint3d cenRotPoint = p1;
		cenRotPoint += vNs[0] * D * 0.02;
		p1.rotateBy(M_PI * 0.5, vCr, cenRotPoint);

		p2 = points[1];
		p2 += uVs[1] * tabHeights[1] * 0.5;
		double delta = (tabHeights[0] - tabHeights[1]) * 0.5 + 0.03 * H;
		makeBend2(p2, -uVs[0], -vCr, sides, false, 90, 90, 0.1, D * 0.15, 0.1, 2 * cpx, 0.02 * D + delta, 0.02 * D + delta);

		cenRotPoint = p2;
		cenRotPoint -= vNs[0] * (0.02 * D + delta);
		p2.rotateBy(M_PI * 0.5, -vCr, cenRotPoint);

		points[0] = p1;
		points[1] = p2;
		tabHeights[0] = tabHeights[1] = D * 0.03;
		tabWidhts[0] = tabWidhts[1] = 0.1;

		points[0] += vCr * D * 0.06;
		points[1] += vCr * D * 0.06;
		makeBox(1, points, vNs, uVs, tabHeights, tabWidhts, sides, true, true, 0, 0, 0);

		points[0] -= vCr * D * 0.12;
		points[1] -= vCr * D * 0.12;
		makeBox(1, points, vNs, uVs, tabHeights, tabWidhts, sides, true, true, 0, 0, 0);

		p1 = p2 = p0;
		p1 += vUp * (H - 0.25 * D);
		p2 += vUp * (H + 0.03 * D);
		p1 += vN * D * 0.1;
		p2 += vN * D * 0.1;
		FdVector3d nV = vUp;
		p1.rotateBy(alfa, vCr, centerRotatePoint);
		p2.rotateBy(alfa, vCr, centerRotatePoint);
		nV.rotateBy(alfa, vCr);
		makeVerySimpleTube(p1, p2, D * 0.04, cpx);

		p1 = p2;
		p2 += nV * D * 0.05;
		makeFlatDisc(p1, nV, D * 0.07, cpx);
		makeVerySimpleTube(p1, p2, D * 0.07, cpx);
		makeFlatDisc(p2, nV, D * 0.07, cpx);

	}
	else if (strcmp(con_t, "Flange") == 0) {
		p1 = p2 = p0;
		p1 += vUp * (H + 0.025 * D);
		p1 += vN * 0.17 * D;
		FdVector3d nV = vUp;
		p1.rotateBy(M_PI * 0.2, vCr, centerRotatePoint);
		nV.rotateBy(M_PI * 0.2, vCr);
		makeRectFace(p1, vCr, nV, D * 0.2, D * 0.08);
		p2 = p1;
		p2 += nV * 0.11 * D;
		makeFlatRing(p2, vCr, 0.04 * D, 0.08 * D, cpx);

		p1 = p2 = p0;
		p1 += vUp * (H + 0.025 * D);
		p1 -= vN * 0.17 * D;
		nV = vUp;
		p1.rotateBy(M_PI * 0.2, -vCr, centerRotatePoint);
		nV.rotateBy(M_PI * 0.2, -vCr);
		makeRectFace(p1, vCr, nV, D * 0.2, D * 0.08);
		p2 = p1;
		p2 += nV * 0.11 * D;
		makeFlatRing(p2, vCr, 0.04 * D, 0.08 * D, cpx);
	}
	//make top - E

	//make bottom - S
	if (strcmp(con_t, "Non-flange") == 0) {
		p1 = p2 = p0;
		p1 += vUp * legHeight;
		p2 += vUp * legHeight;
		p2 -= vUp * 0.25 * D;
		makeSimpleTube(p1, p2, 0.5 * D, 0.25 * D, cpx);

		p1 = p2;
		p2 -= vUp * 0.015 * D;
		makeVerySimpleTube(p1, p2, 0.3 * D, cpx);
		makeFlatDisc(p1, vUp, 0.3 * D, cpx);
		makeFlatDisc(p2, vUp, 0.3 * D, cpx);

		FdPoint3d points[2] = { p1, p2 };
		points[0] += vUp * 0.0025 * D;
		points[1] -= vUp * 0.0025 * D;
		points[0] += vN * 0.13 * D;
		points[1] += vN * 0.13 * D;
		for (int i = 0; i < 8; i++) {
			points[0].rotateBy(M_PI / 4, vUp, p1);
			points[1].rotateBy(M_PI / 4, vUp, p1);
			makeVerySimpleTube(points, 0.02 * D, cpx);
			makeFlatDisc(points[0], vUp, 0.02 * D, cpx);
			makeFlatDisc(points[1], vUp, 0.02 * D, cpx);
			makeScrew(points[1], -vUp, vN, 0.02 * D * 1.13, 0.01 * D, true, true);
		}

		p1 = p2;
		p2 = p0;
		p2 += vUp * h2;
		makeVerySimpleTube(p1, p2, d, cpx);
		makeVerySimpleTube(p1, p2, d * 0.9, cpx);
		makeFlatRing(p2, vUp, d * 0.9, d, cpx);
	}
	else if (strcmp(con_t, "Flange") == 0) {
		p1 = p2 = p0;
		p1 += vUp * legHeight;
		p2 += vUp * legHeight;
		p2 -= vUp * 0.29 * D;
		makeSimpleTube(p1, p2, 0.25 * D, 0.25 * D, cpx);

		FdPoint3d points[2];

		p1 = p2;
		p1 += vUp * 0.01 * D;
		makeFlatDisc(p1, vUp, 0.3 * D, cpx);
		makeVerySimpleTube(p1, p2, 0.3 * D, cpx);
		makeFlatDisc(p2, vUp, 0.3 * D, cpx);
		points[1] = p2;

		p1 += vUp * 0.015 * D;
		p2 += vUp * 0.015 * D;
		makeFlatDisc(p1, vUp, 0.3 * D, cpx);
		makeVerySimpleTube(p1, p2, 0.3 * D, cpx);
		makeFlatDisc(p2, vUp, 0.3 * D, cpx);
		points[0] = p1;

		points[0] += vUp * 0.0025 * D;
		points[1] -= vUp * 0.0025 * D;
		points[0] += vN * 0.13 * D;
		points[1] += vN * 0.13 * D;
		for (int i = 0; i < 8; i++) {
			points[0].rotateBy(M_PI / 4, vUp, p1);
			points[1].rotateBy(M_PI / 4, vUp, p1);
			makeVerySimpleTube(points, 0.02 * D, cpx);
			makeFlatDisc(points[0], vUp, 0.02 * D, cpx);
			makeFlatDisc(points[1], vUp, 0.02 * D, cpx);
			makeScrew(points[0], vUp, vN, 0.02 * D * 1.13, 0.01 * D, true, true);
			makeScrew(points[1], -vUp, vN, 0.02 * D * 1.13, 0.01 * D, true, true);
		}

		p1 = p2 = p0;
		p1 += vUp * legHeight;
		p2 += vUp * legHeight;
		p2 -= vUp * 0.29 * D;

		p1 = p2;
		p2 = p0;
		p2 += vUp * h2;
		makeVerySimpleTube(p1, p2, 0.5 * d, cpx);

		p1 = p2;
		p1 += vUp * 5;
		makeFlatRing(p1, vUp, 0.5 * d, d, cpx);
		makeVerySimpleTube(p1, p2, d, cpx);
		makeFlatRing(p2, vUp, 0.5 * d, d, cpx);
	}
	//make bottom -E

	return 0;
}

short CGeneralBlockCreator::makeWashingMashineFront()
{

	ads_real H = 848; get_val("H", H); //Height = 848
	ads_real W = 600; get_val("W", W); //Width = 848
	ads_real L = 600; get_val("L", L); //Length = 848
	ads_real d1 = 25; get_val("d1", d1); //Cole water connector = 25;
	ads_real d2 = 15; get_val("d2", d2); // Sewage connector = 15;


	//WashmachineFront
	//main
	FdPoint3d startP(0, 0, 0),
		endP(0, 0, 0);
	startP.y = 3 * L / 8;
	endP.y = startP.y;
	endP.z = H - H / 20;
	double width1[2] = { W, W };
	double height1[2] = { 3 * L / 4, 3 * L / 4 };
	FdPoint3d box1[2] = { startP, endP };
	makeBox(1, box1, height1, width1, false);
	makeRectFace(startP, vz, vy, 3 * L / 4, W);
	makeRectFace(endP, vz, vy, 3 * L / 4, W);
	startP.y = startP.y - L / 24;
	endP.y = startP.y;
	startP.z = endP.z;
	endP.z = H;
	double height2[2] = { 3 * L / 4 + L / 12, 3 * L / 4 + L / 12 };
	FdPoint3d box2[2] = { startP, endP };
	makeBox(1, box2, height2, width1, false);
	makeRectFace(startP, vz, vy, 3 * L / 4 + L / 12, W);
	makeRectFace(endP, vz, vy, 3 * L / 4 + L / 12, W);

	//bot
	FdPoint3d sp, ep;
	sp.x = W / 2 - 15 * W / 200;
	sp.y = L / 12;
	ep.z = -H / 100;
	ep.x = sp.x;
	ep.y = sp.y;
	makeVerySimpleTube(sp, ep, W / 10, 4 * cpx);
	makeFlatDisc(ep, vz, W / 10, 4 * cpx);

	sp.x = -W / 2 + 15 * W / 200;
	ep.x = sp.x;
	ep.y = sp.y;
	makeVerySimpleTube(sp, ep, W / 10, 4 * cpx);
	makeFlatDisc(ep, vz, W / 10, 4 * cpx);

	sp.y = 3 * L / 4 - L / 12;
	ep.x = sp.x;
	ep.y = sp.y;
	makeVerySimpleTube(sp, ep, W / 10, 4 * cpx);
	makeFlatDisc(ep, vz, W / 10, 4 * cpx);

	sp.x = W / 2 - 15 * W / 200;
	ep.x = sp.x;
	ep.y = sp.y;
	makeVerySimpleTube(sp, ep, W / 10, 4 * cpx);
	makeFlatDisc(ep, vz, W / 10, 4 * cpx);

	//front
	startP.y = 3 * L / 4 + 15 * L / 600;
	startP.z = 0;
	endP.y = 3 * L / 4 + 35 * L / 600;
	endP.z = H / 8;
	double height3[2] = { 30 * L / 600, 70 * L / 600 };
	FdPoint3d box3[2] = { startP, endP };
	FdVector3d vt1[2] = { vz, vz };
	bool side[4] = { true, true, true, true };
	bool connector[2] = { false, false };
	makeBox(1, box3, vt1, height3, width1, side, connector, true, true);

	startP.z = H;
	endP.z = H - H / 8;
	FdPoint3d box4[2] = { startP, endP };
	makeBox(1, box4, vt1, height3, width1, side, connector, true, true);

	startP.y = endP.y;
	startP.z = H / 8;
	endP.z = H - H / 8;
	double height4[2] = { 70 * L / 600, 70 * L / 600 };
	FdPoint3d box5[2] = { startP, endP };
	makeBox(1, box5, height4, width1, false);
	startP.y = 3 * L / 4 + 70 * L / 600;
	startP.z = 457 * H / 848;
	endP.z = startP.z;
	endP.y = L - 15 * L / 600;
	setMeshColor(0, 0, 0);
	makeVerySimpleTube(startP, endP, 40 * W / 60, 4 * cpx);
	makeVerySimpleTube(startP, endP, 50 * W / 60, 4 * cpx);
	makeFlatRing(endP, vy, 40 * W / 60, 50 * W / 60, 4 * cpx);
	startP.y = startP.y + 5;
	setMeshColor(255, 255, 255);
	makeFlatDisc(startP, vy, 40 * W / 60, 4 * cpx);
	setMeshColor(0);

	startP.y = 3 * L / 4 + 50 * L / 600;
	startP.z = H - H / 16;
	FdVector3d vt2(0, H / 8, 40 * L / 600);
	vt2.normalize();
	endP.z = startP.z + 8 * L / 600;
	endP.y = startP.y + 2 * H / 80;
	FdPoint3d tube1[2] = { startP, endP };
	double dia[2][2] = { 40 * L / 600, 40 * L / 600, 40 * L / 600, 40 * L / 600 };
	FdVector3d vt3[2] = { vt2, vt2 };
	makeTube(tube1, vt3, dia, 4 * cpx, 1, false, true);
	makeFlatDisc(endP, vt2, 40 * L / 600, 4 * cpx);

	// hose

	startP.y = 0;
	startP.z = H - 94 * H / 848;
	startP.x = -W / 2 + 169 * W / 600;
	endP.x = startP.x;
	endP.z = startP.z;
	endP.y = startP.y - L / 50;
	makeVerySimpleTube(startP, endP, 2 * d1, 4 * cpx);
	makeVerySimpleTube(startP, endP, d1, 4 * cpx);
	makeFlatRing(endP, vy, d1, 2 * d1, 4 * cpx);
	startP.y = endP.y - L / 10;
	FdPoint3d sp2, ep2;
	sp2.x = endP.x;
	sp2.y = endP.y;
	sp2.z = startP.z - L / 10;
	makeTubularBend(sp2, vx, vz, L / 10, d1, 90, 4 * cpx, 20, true, false);
	startP.z = endP.z - L / 10;
	endP.z = startP.z - H / 3;
	endP.y = startP.y;
	makeVerySimpleTube(startP, endP, d1, 4 * cpx);
	startP.z = endP.z;
	endP.z = endP.z + H / 30;
	makeVerySimpleTube(startP, endP, d1, 4 * cpx);
	makeVerySimpleTube(startP, endP, d1 + d1 / 2, 4 * cpx);
	makeFlatRing(startP, vz, d1, d1 + d1 / 2, 4 * cpx);
	makeFlatRing(endP, vz, d1, d1 + d1 / 2, 4 * cpx);


	startP.y = 0;
	startP.z = H - 114 * H / 848;
	startP.x = W / 2 - 68 * W / 600;
	endP.x = startP.x;
	endP.z = startP.z;
	endP.y = startP.y - L / 50;
	makeVerySimpleTube(startP, endP, 2 * d2, 4 * cpx);
	makeVerySimpleTube(startP, endP, d2, 4 * cpx);
	makeFlatRing(endP, vy, d2, 2 * d2, 4 * cpx);
	startP.y = endP.y - L / 10;
	sp2.x = endP.x;
	sp2.y = endP.y;
	sp2.z = startP.z - L / 10;
	makeTubularBend(sp2, vx, vz, L / 10, d2, 90, 4 * cpx, 20, true, false);
	startP.z = endP.z - L / 10;
	endP.z = startP.z - H / 3;
	endP.y = startP.y;
	makeVerySimpleTube(startP, endP, d2, 4 * cpx);
	startP.z = endP.z;
	endP.z = endP.z + H / 30;
	makeVerySimpleTube(startP, endP, d2, 4 * cpx);
	makeVerySimpleTube(startP, endP, d2 + d2 / 2, 4 * cpx);
	makeFlatRing(startP, vz, d2, d2 + d2 / 2, 4 * cpx);
	makeFlatRing(endP, vz, d2, d2 + d2 / 2, 4 * cpx);

	startP.y = 0;
	startP.z = H - 75 * H / 848;
	startP.x = W / 2 - 123 * W / 600;
	endP.x = startP.x;
	endP.z = startP.z;
	endP.y = startP.y - L / 50;
	makeVerySimpleTube(startP, endP, W / 32, 4 * cpx);
	makeVerySimpleTube(startP, endP, W / 32, 4 * cpx);
	makeFlatRing(endP, vy, W / 64, W / 32, 4 * cpx);
	startP.y = endP.y - L / 10;
	sp2.x = endP.x;
	sp2.y = endP.y;
	sp2.z = startP.z - L / 10;
	makeTubularBend(sp2, vx, vz, L / 10, W / 64, 90, 4 * cpx, 20, true, false);
	startP.z = endP.z - L / 10;
	endP.z = startP.z - H / 3;
	endP.y = startP.y;
	makeVerySimpleTube(startP, endP, W / 64, 4 * cpx);
	startP.z = endP.z;
	endP.z = endP.z + H / 30;
	makeVerySimpleTube(startP, endP, W / 64, 4 * cpx);
	makeVerySimpleTube(startP, endP, W / 64 + W / 64, 4 * cpx);
	makeFlatRing(startP, vz, W / 64, W / 64 + W / 64, 4 * cpx);
	makeFlatRing(endP, vz, W / 64, W / 64 + W / 64, 4 * cpx);


	startP.x = 0;
	startP.y = 0;
	startP.z = 37 * H / 848 + W / 3;
	endP.x = 0;
	endP.y = -44 * L / 600;
	endP.z = startP.z;
	makeVerySimpleTube(startP, endP, 2 * W / 3, 4 * cpx);
	makeFlatDisc(endP, vy, 2 * W / 3, 4 * cpx);
	startP.z = H - 130 * H / 848 - W / 3;
	endP.z = startP.z;
	makeVerySimpleTube(startP, endP, 2 * W / 3, 4 * cpx);
	makeFlatDisc(endP, vy, 2 * W / 3, 4 * cpx);
	endP.z = 37 * H / 848 + W / 3;
	startP.y = -22 * L / 600;
	endP.y = startP.y;
	double width2[2] = { 2 * W / 3 , 2 * W / 3 };
	double height5[2] = { 44 * L / 600 + 0.1, 44 * L / 600 + 0.1 };
	FdPoint3d box6[2] = { startP, endP };
	makeBox(1, box6, height5, width2, false);
	return 0;
}

short CGeneralBlockCreator :: makeFCHC()
	{
	int cpx = 10;
	double A;  get_val("A", A);
	double B;  get_val("B", B);
	double C;  get_val("C", C);

	// A = 1540;
	B = 580;
	C = 243;

	FdPoint3d cP[2];
	cP[0].set(0, 0, 0);
	cP[1].set(0, 0, B);

	FdVector3d V[] = { vz,vz };
	FdVector3d upV[] = { vy, vy };
	double tabWidth[2] = { A, A };
	double tabHeight[2] = { C / 3, C / 3 };

	bool sides[] = { true, true, true, true,
	                 true, true, true, true,
	                 true, true, true, true };
	bool edges[4][4] = { false, false, false, false,
	                     false, false, false, false,
	                     false, false, false, false,
	                     false, false, false, false };
	makeBox(1, cP, V, upV, tabWidth, tabHeight, sides, edges, true, true, 1, 0, 0);

	cP[0].set(0, C / 2, 0);
	cP[1].set(0, C / 2, B - 2 * C / 3);
	tabHeight[0] = tabHeight[1] = 2 * C / 3;
	makeBox(1, cP, V, upV, tabWidth, tabHeight, sides, edges, true, true, 1, 0, 0);

	double beginWidth = 2 * C / 3;
	double endWidth = 2 * C / 3;
	double Height = A;

	bool bendSides1[4] = { true, true, true, true };

	makeBend(cP[1], -vz, vx, bendSides1, 90, 90, beginWidth, Height, endWidth, cpx, 0.01, 0.01);

	cP[0].set(0, 5 * C / 6, B / 4);
	double x = A - 100;
	V[0] = vy;
	upV[0] = vz;
	addSymbolicFlangeRect(cP[0], V[0], upV[0],  200, x);
	addSymbolicFlangeRect(cP[0], V[0], upV[0],  150, x);
	addSymbolicFlangeRect(cP[0], V[0], upV[0],  100, x);
	addSymbolicFlangeRect(cP[0], V[0], upV[0],   50, x);
	addSymbolicFlangeRect(cP[0], V[0], upV[0], 0.01, x);

	cP[0].x = 0;
	cP[0].y = 5 * C / 6;
	cP[0].z = B - 2 * C / 3;
	addSymbolicFlangeRect(cP[0], V[0], upV[0], 25, x);

	B = 580;
	C = 243;
	for( int i = 1; i <= 8; i++ )
		{
		double alfa = 10;
		alfa = alfa * ARX_PI / 180;
		double H = B - 2 * C / 3;
		double D = endWidth;
		V[0].rotateBy(alfa, vx);
		upV[0].rotateBy(alfa, vx);
		cP[0].x = 0;
		cP[0].z = B - 2 * C / 3 + D * sin(alfa * i);
		cP[0].y = C / 6 + D * cos(alfa * i);
		// cP[0] = { 0, C / 6, 0 };
		addSymbolicFlangeRect(cP[0], V[0], upV[0], 25, x);
		};

	V[0] = vz;
	upV[0] = vy;

	cP[0].x = 0;
	cP[0].y = C / 12;
	cP[0].z = B;
	addSymbolicFlangeRect(cP[0], V[0], upV[0], 25, x);
	cP[0].y = C / 6;
	addSymbolicFlangeRect(cP[0], V[0], upV[0], 25, x);
	return 0;
	};

short CGeneralBlockCreator :: makeFCVC()
	{
	int cpx = 10;
	double A;  get_val("A", A);
	double B;  get_val("B", B);
	double C;  get_val("C", C);

	// A = 1540;
	B = 580;
	C = 243;

	FdPoint3d cp1, cp2;
	FdPoint3d cP[2];
	cp1[0] = (0, 0, 0);
	cp2[1] = (B, 0, 0);

	FdVector3d v[] = { vx,vx };
	FdVector3d upV[] = { vz, vz };
	double tabWidth[2] = { A, A };
	double tabHeight[2] = { -C / 3, -C / 3 };

	bool sides[] = { true, true, true, true,
	                 true, true, true, true,
	                 true, true, true, true };
	bool edges[4][4] = { false, false, false, false,
	                     false, false, false, false,
	                     false, false, false, false,
	                     false, false, false, false };
	makeBox(1, cP, v, upV, tabWidth, tabHeight, sides, edges, true, true, 1, 0, 0);

	cp1[0] = (0,             0, -C / 2);
	cp2[1] = (B - 2 * C / 3, 0, -C / 2);
	tabHeight[0] = tabHeight[1] = 2 * C / 3;
	makeBox(1, cP, v, upV, tabWidth, tabHeight, sides, edges, true, true, 1, 0, 0);

	double beginWidth = 2 * C / 3;
	double endWidth = 2 * C / 3;
	double Height =  A;

	bool bendSides1[4] = { true, true, true, true };
	double vector[3] = { 1, 0, 0 };
	double upVector[3] = { 0, 1, 0 };
	upV[0] = -vy;
	makeBend(cP[1], -vx,upV[0], bendSides1, 90, 90, beginWidth, Height, endWidth, cpx, 0.01, 0.01);

	return 0;
	};

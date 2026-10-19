#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define GLECircular SmkGenBlockCreator
#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

////////////////////////////////////BEGINNING OF MAKE GENERAL CIRCULAR ELEMENT FUNCTIONS//////////////////////////////////
void GLECircular::makeAP1(double diam1, double length1, double size, int n)
{
	/**********************************GEOMETRY*************************************/
	FdPoint3d p1, p2;
	p1.set(0, 0, 0);
	p2.set(length1, 0, 0);
	FdPoint3d p[3] = { p1, p2, p2 };

	double diams[3] = { diam1, diam1, diam1 + size * 2 };
	makeStraightTube(p, diams, n, 2, true);

	//--- Add Hlr Info.
	addCircularConnector(p1);
	drawAsThinArc(p2, diam1 / 2 + size);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1;

	/**********************************Ext Insulation*******************************/
	double size2;
	if( getExtInsSize(size2) )
	{
		diam1 += 2 * size2;
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1, p2; 
		p1.set(0, 0, 0);
		p2.set(length1, 0, 0);
		FdPoint3d p[2] = { p1, p2 };

		double diams[2] = { diam1, diam1 };
		makeStraightTube(p, diams, n, 1, true);

		makeFlatRing(p1, vx, diam1, diam1 - 2 * size2, n);
		makeFlatRing(p2, vx, diam1, diam1 - 2 * size2, n);
	}

	/**********************************Recover variables*******************************/
	diam1 = copydiam1;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size2) )
	{
		diam1 -= 2 * size2;
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		FdPoint3d p1, p2;
		p1.set(0, 0, 0);
		p2.set(length1, 0, 0);
		FdPoint3d p[2] = { p1, p2 };

		double diams[2] = { diam1, diam1 };
		makeStraightTube(p, diams, n, 1, true);

		makeFlatRing(p1, vx, diam1, diam1 + 2 * size2, n);
		makeFlatRing(p2, vx, diam1, diam1 + 2 * size2, n);
	}
}

void GLECircular::makeAYE(double length1, double length2, double length3, double diam1, double diam2, double angle, int n)
{
	/**********************************GEOMETRY*************************************/
	
	
	//if the intersecting tube's diameter<=main's, then the connectors needn't be drawn seperately...
	//in other words, they can just be included as part of the main tube...but if the intersecting tube's 
	//diameter>main's, then the two connectors must be drawn seperately
	FdPoint3d p1, p2, p3, p4;
	double tubeData[2] = {diam1, length1+length3*2};
	double interTubeData[4] = {diam2, length2, tubeData[1]/2-diam1/2, 0};
	double angles[2] = {angle, 270};

	if(diam2<=diam1){
		//---define the directional vector for both tee intersection functions
		p1.set(-(length1+length3*2)/2, 0, 0);
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		//---define the center line and connecctor of the intersecting tube
		p1.set(-(length1+length3*2)/2+tubeData[1]/2-diam1/2, 0, 0);
		p2.set(-(length1+length3*2)/2+tubeData[1]/2-diam1/2+cos(angle*(M_PI/180))*length2, sin(angle*(M_PI/180))*length2, 0);
		addCenterLine(p1, p2);
		
		p1.set(-(length1+length3*2)/2+tubeData[1]/2-diam1/2+cos(angle*(M_PI/180))*length2, sin(angle*(M_PI/180))*length2, 0);
		addCircularConnector(p1);

	}else{
		tubeData[0] = diam2;
		double alpha = M_PI / 2 - angle * (M_PI / 180);
		tubeData[1] = ((diam2/2)/sin(alpha))*2;
		p1.set(-length1/2 + (length1-tubeData[1])/2 + (diam2-diam1)/2, 0, 0);
		interTubeData[2] = interTubeData[2] - (length1-tubeData[1])/2 - (diam2-diam1)/2;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		p3.set(-length1/2, 0, 0);
		p4.set(p1.x, 0, 0);
		makeSimpleTube(p3, p4, diam1, diam2, n);

		p3.x = p1.x + tubeData[1];
		p4.x = length1/2;
		makeSimpleTube(p3, p4, diam2, diam1, n);

		//---define the center line and connector of the intersecting tube
		p3.set(p1.x + interTubeData[2], 0, 0);
		p4.set(p1.x + interTubeData[2]+cos(angle*(M_PI/180))*length2, sin(angle*(M_PI/180))*length2, 0);
		addCenterLine(p3,p4);

		p3.set(p1.x + interTubeData[2]+cos(angle*(M_PI/180))*length2, sin(angle*(M_PI/180))*length2, 0);
		addCircularConnector(p3);
	}
	
	/****************************Copy/create Insulation vairables*******************/
	double copylength1 = length1, copylength2 = length2, copylength3 = length3, copydiam1 = diam1, copydiam2 = diam2, copyangle = angle;
	/**********************************Ext Insulation*******************************/
	
	setMeshColor(1);
	double size;
	if ( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		diam1 += 2 * size;
		diam2 += 2 * size;

		FdPoint3d p1, p2, p3, p4;
		double tubeData[2] = { diam1, length1 + length3 * 2 };
		double interTubeData[4] = { diam2, length2, tubeData[1] / 2 - (diam1 - 2 * size) / 2, 0 };
		double angles[2] = { angle, 270 };

		if( diam2 <= diam1 ) {
			//--- define the directional vector for both tee intersection functions
			p1.set(-(length1 + length3 * 2) / 2, 0, 0);
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);
		} else {
			tubeData[0] = diam2;
			double alpha = M_PI / 2 - angle * (M_PI / 180);
			tubeData[1] = (((diam2 - 2 * size) / 2) / sin(alpha)) * 2;
			p1.set(-length1 / 2 + (length1 - tubeData[1]) / 2 + (diam2 - diam1) / 2, 0, 0);
			interTubeData[2] = interTubeData[2] - (length1 - tubeData[1]) / 2 - (diam2 - diam1) / 2;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

			p3.set(-length1 / 2, 0, 0);
			p4.set(p1.x, 0, 0);
			makeSimpleTube(p3, p4, diam1, diam2, n);

			p3.x = p1.x + tubeData[1];
			p4.x = length1 / 2;
			makeSimpleTube(p3, p4, diam2, diam1, n);
		}

		FdPoint3d rp;
		rp.set(-length1 / 2, 0, 0);
		makeFlatRing(rp, vx, diam1, diam1 - 2 * size, n);
		
		rp.set( length1 / 2, 0, 0);
		makeFlatRing(rp, vx, diam1, diam1 - 2 * size, n);

		FdVector3d rotv = vy;
		rotv.rotateBy(angle * ARX_PI / 180, -vz);
		rp.set(-length1 / 2 + interTubeData[2], 0, 0);
		rotv.normalize();
		rp += rotv * interTubeData[1];
		makeFlatRing(rp, rotv, diam2, diam2 - 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copylength1 = length1;  copylength2 = length2;  copylength3 = length3;  copydiam1 = diam1;  copydiam2 = diam2;  copyangle = angle;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		diam1 -= 2 * size;
		diam2 -= 2 * size;

		FdPoint3d p1, p2, p3, p4;
		double tubeData[2] = { diam1, length1 + length3 * 2 };
		double interTubeData[4] = { diam2, length2, tubeData[1] / 2 - (diam1 + 2 * size) / 2, 0 };
		double angles[2] = {angle, 270};

		if(diam2<=diam1){
			//---define the directional vector for both tee intersection functions
			p1.set(-(length1+length3*2)/2, 0, 0);
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);



		}else{
			tubeData[0] = diam2;
			double alpha = M_PI / 2 - angle * (M_PI / 180);
			tubeData[1] = (((diam2 + 2 * size) / 2) / sin(alpha)) * 2;
			p1.set(-length1/2 + (length1 - tubeData[1]) / 2 + (diam2 - diam1) / 2, 0, 0);
			interTubeData[2] = interTubeData[2] - (length1 - tubeData[1]) / 2 - (diam2 - diam1) / 2;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

			p3.set(-length1 / 2, 0, 0);
			p4.set(p1.x, 0, 0);
			makeSimpleTube(p3, p4, diam1, diam2, n);

			p3.x = p1.x + tubeData[1];
			p4.x = length1 / 2;
			makeSimpleTube(p3, p4, diam2, diam1, n);
		}

		FdPoint3d rp;
		rp.set(-length1 / 2, 0, 0);
		makeFlatRing(rp, vx, diam1, diam1 + 2 * size, n);

		rp.set( length1 / 2, 0, 0);
		makeFlatRing(rp, vx, diam1, diam1 + 2 * size, n);

		FdVector3d rotv = vy;
		rotv.rotateBy(angle * ARX_PI / 180, -vz);
		rp.set(-length1 / 2 + interTubeData[2], 0, 0);
		rotv.normalize();
		rp += rotv * interTubeData[1];
		makeFlatRing(rp, rotv, diam2, diam2 + 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copylength1 = length1;  copylength2 = length2;  copylength3 = length3;  copydiam1 = diam1;  copydiam2 = diam2;  copyangle = angle;


	//---if intersecting diam >= main, we actually get ellipses at the saddle of the intersection,
	//---not splines, so we must remember to specify that these should be thin
	if(diam2==diam1)
		p3.set(-length1/2+tubeData[1]/2-diam1/2, 0, 0);
		drawAsThinArc(p3);
	if(diam2>diam1)
		p3.set(p1.x + interTubeData[2], 0, 0);
		drawAsThinArc(p3);

	setHlrSplineType(hlrThin);
	
	p3.set(-(length1+length3*2)/2, 0, 0);
	addCircularConnector(p3);
	
	p3.set((length1+length3*2)/2, 0, 0);
	addCircularConnector(p3);
	
	p3.set(-(length1+length3*2)/2, 0, 0);
	p4.set((length1+length3*2)/2, 0, 0);
	addCenterLine(p3, p4);
}

void GLECircular::makeATE(double length1, double length2, double length3, double diam1, double diam2, int n[2])
{
	//--- Some initial points and a vector that will
	//--- be used repeatedly to create this element.
	FdPoint3d  left   ( -length1 / 2, 0,       0 );
	FdPoint3d  right  (  length1 / 2, 0,       0 );
	FdPoint3d  up     (  0,           length2, 0 );
	FdVector3d normal (  1,           0,       0 );

	//--- If the intersecting tube has a smaller diameter than 
	//--- the main tube, this is a simple call to one primitive.
	double interTubeData[4] = { diam2, length2, length1 / 2, 0 };
	double angles[2]		= { 0, 270 };
	if( diam2 <= diam1 )
	{
		//--- Make the element.
		double tubeData[2] = { diam1, length1 };
		makeTubeToTubeIntersection2(left, normal, tubeData, interTubeData, angles, n[0], false);

		//--- Add internal insulation.
	double intInsOffset;
	if( getIntInsSize(intInsOffset) )
		{
	#ifndef __TODO__
		setMeshColor(3);
	#endif
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		interTubeData[0] = diam2 - intInsOffset * 2;
		tubeData[0] = diam1  - intInsOffset * 2;
		makeTubeToTubeIntersection2(left, normal, tubeData, interTubeData, angles, n[0], false);
		makeFlatRing(left, normal, diam1, tubeData[0], n[0]);
		makeFlatRing(right, normal, diam1, tubeData[0], n[0]);
		makeFlatRing(up, yVec, diam2, interTubeData[0], n[0]);
		};

		//--- Add external insulation.
	double extInsOffset;
	if( getExtInsSize(extInsOffset) )
		{
	#ifndef __TODO__
		setMeshColor(1);
	#endif
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		interTubeData[0] = diam2 + extInsOffset * 2;
		tubeData[0] = diam1 + extInsOffset * 2;
		makeTubeToTubeIntersection2(left, normal, tubeData, interTubeData, angles, n[0], false);
		makeFlatRing(left, normal, diam1, tubeData[0], n[0]);
		makeFlatRing(right, normal, diam1, tubeData[0], n[0]);
		makeFlatRing(up, yVec, diam2, interTubeData[0], n[0]);
		};
	}
	//--- Otherwise we have to make the intersection with three primitives.
	else
	{
		//--- Make the element.
		FdPoint3d start( -diam2 / 2, 0, 0 );
		double tubeData[2] = { diam2, diam2 };
		interTubeData[2] = diam2 / 2;
		makeTubeToTubeIntersection2(start, normal, tubeData, interTubeData, angles, n[0], false);
		makeSimpleTube(left, start, diam1, diam2, n[0]);
		start.x = diam2 / 2;
		makeSimpleTube(start, right, diam2, diam1, n[0]);

		//--- Make internal insulation.
		double intInsOffset;
		if( getIntInsSize(intInsOffset) )
			{
			start.x = -diam2 / 2 + intInsOffset;
		#ifndef __TODO__
			setMeshColor(3);
		#endif
			setPrimitiveMode(FLM3Geo::pmIntInsulation);
			tubeData[0] = diam2 - intInsOffset * 2;
			interTubeData[0] = diam2 - intInsOffset * 2;
			interTubeData[2] = diam2 / 2 - intInsOffset;
			tubeData[1] = diam2 - intInsOffset * 2;
			makeTubeToTubeIntersection2(start, normal, tubeData, interTubeData, angles, n[0], false);
			makeSimpleTube(left, start, diam1 - intInsOffset * 2, tubeData[0], n[0]);
			start.x = diam2 / 2 - intInsOffset;
			makeSimpleTube(start, right, tubeData[0], diam1 - intInsOffset * 2, n[0]);
			makeFlatRing(left, normal, diam1 - intInsOffset * 2, diam1, n[0]);
			makeFlatRing(right, normal, diam1 - intInsOffset * 2, diam1, n[0]);
			makeFlatRing(up, yVec, interTubeData[0], diam2, n[0]);
			};

		//--- Make external insulation.
		double extInsOffset;
		if( getExtInsSize(extInsOffset) )
			{
			start.x = -diam2 / 2 - extInsOffset;
	#ifndef __TODO__
			setMeshColor(1);
	#endif
			setPrimitiveMode(FLM3Geo::pmExtInsulation);
			tubeData[0] = diam2 + extInsOffset * 2;
			interTubeData[0] =  diam2 + extInsOffset * 2;
			interTubeData[2] = diam2 / 2 + extInsOffset;
			tubeData[1] = diam2 + extInsOffset * 2;
			makeTubeToTubeIntersection2(start, normal, tubeData, interTubeData, angles, n[0], false);
			makeSimpleTube(left, start, diam1 + extInsOffset * 2, tubeData[0], n[0]);
			start.x = diam2 / 2 + extInsOffset;
			makeSimpleTube(start, right, tubeData[0], diam1 + extInsOffset * 2, n[0]);
			makeFlatRing(left, normal, diam1, diam1 + extInsOffset * 2, n[0]);
			makeFlatRing(right, normal, diam1, diam1 + extInsOffset * 2, n[0]);
			makeFlatRing(up, yVec, diam2, interTubeData[0], n[0]);
			};
	}

	//--- The curve which represents the intersection of the main and 
	//--- intersecting tube must be drawn as thin, not outline.  If the 
	//--- intersecting tube has a smaller diameter than the main tube,
	//--- this intersection curve is a spline, so we set the color for
	//--- splines as thin.  If intersecting diam >= main, we actually 
	//--- get ellipses at the saddle of the intersection, not splines, 
	//--- so we must remember to specify that these should be thin.
	if( diam2 >= diam1 )
		drawAsThinArc(FdPoint3d::kOrigin);
	else
		setHlrSplineType(hlrThin);

	//--- Add points which represent the center points of the connectors.
	addCircularConnector(left);
	addCircularConnector(right);
	addCircularConnector(up);

	//---- Add center lines for...
	//-- the main tube axis.
	addCenterLine(left, right);
	//-- the intersecting tube axis.
	addCenterLine(FdPoint3d::kOrigin, up);
}

void GLECircular::makeARE(double length1, double length2, double length3, double length4, double diam1, double diam2, double diam3, int n[2], double l3)
{
	/**********************************GEOMETRY*************************************/
	FdPoint3d p1, p2, p3, p4;
	FdPoint3d centers[4];
	double diams[4];//for the reducer diameters...this function takes only a 1D array
	int numOfSegs = 3;

	//if the intersecting tube's diameter is less than the main tube's, then this is
	//2 calls...once to makeTubeIntersection() and once to makeStraightTube()...however, if the intersecting
	//tube's diameter is greater than or equal to the main tube's, then we call makeOptTubeIntersection() and makeStraightTube()

	//MAKE REDUCER
	p1.set(length1/2-length2-length3-length4, 0, 0);
	centers[0] = p1;	
	diams[0] = diam1;
	
	if(length3==0){
		numOfSegs--;
		diams[1] = diam2;
		p2.set(length1/2-length4, 0, 0);
		centers[1] = p2;
	}else{
		diams[1] = diam1;
		diams[2] = diam2;
		p2.set(length1/2-length2-length4, 0, 0);
		centers[1] = p2;
		p3.set(length1/2-length4, 0, 0);
		centers[2] = p3;
	}

	if(length4==0){
		numOfSegs--;
	}else{
		if(length3==0){
			diams[2] = diam2;
			p3.set(length1/2, 0, 0);
			centers[2] = p3;
		}else{
			diams[3] = diam2;
			p4.set(length1/2, 0, 0);
			centers[3] = p4;
		}
	}
	makeStraightTube(centers, diams, n[0], numOfSegs, true);

	// MAKE TUBE INTERSECTION
	p1.set(-length1 / 2, 0, 0);
	 
	double tubeData[2] = { diam1, length1 - length2 - length3 - length4 };
	double interTubeData[4] = { diam3, l3, (length1 - length2 - length3 - length4) / 2, 0 };
	double angles[2] = { 0, 270 };
	if( diam3 <= diam1 )
	{
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n[0], false);
	} else {
		p1.set(-length1 / 2, 0, 0);
		p2.set(-length1 / 2 + (tubeData[1] - diam3) / 2, 0, 0);
		makeSimpleTube(p1, p2, diam1, diam3, n[0]);

		p1.x = p2.x + diam3;
		p2.x = p1.x + (tubeData[1] - diam3) / 2; 
		makeSimpleTube(p1, p2, diam3, diam1, n[0]);
		
		p1.set(-length1 / 2 + (tubeData[1] - diam3) / 2, 0, 0);
		tubeData[0] = diam3;
		tubeData[1] = diam3;
		interTubeData[2] = diam3 / 2;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n[0], false);
	}

	/****************************Copy/create Insulation vairables*******************/
	double copylength1 = length1, copylength2 = length2, copylength3 = length3, copylength4 = length4,
		copydiam1 = diam1, copydiam2 = diam2, copydiam3 = diam3;
	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		diam1 += 2 * size;
		diam2 += 2 * size;
		diam3 += 2 * size;
		// makeARE(l1, l1 - l4, 0, 0, d1, d2, d3, n);

		FdPoint3d p1, p2, p3, p4;
		FdPoint3d centers[4];
		double diams[4];  // for the reducer diameters...this function takes only a 1D array
		int numOfSegs = 3;

		// if the intersecting tube's diameter is less than the main tube's, then this is
		// 2 calls...once to makeTubeIntersection() and once to makeStraightTube()...however, if the intersecting
		// tube's diameter is greater than or equal to the main tube's, then we call makeOptTubeIntersection() and makeStraightTube()

		// MAKE REDUCER
		p1.set(length1 / 2 - length2 - length3 - length4, 0, 0);
		centers[0] = p1;
		diams[0] = diam1;

		if( length3 == 0 ) {
			numOfSegs--;
			diams[1] = diam2;
			p2.set(length1 / 2 - length4, 0, 0);
			centers[1] = p2;
		} else {
			diams[1] = diam1;
			diams[2] = diam2;
			p2.set(length1 / 2 - length2 - length4, 0, 0);
			centers[1] = p2;
			p3.set(length1 / 2 - length4, 0, 0);
			centers[2] = p3;
		}

		if( length4 == 0 ) {
			numOfSegs--;
		} else {
			if( length3 == 0 ) {
				diams[2] = diam2;
				p3.set(length1 / 2, 0, 0);
				centers[2] = p3;
			} else {
				diams[3] = diam2;
				p4.set(length1 / 2, 0, 0);
				centers[3] = p4;
			}
		}
		makeStraightTube(centers, diams, n[0], numOfSegs, true);

		// MAKE TUBE INTERSECTION
		p1.set(-length1 / 2, 0, 0);

		double tubeData[2] = { diam1, length1 - length2 - length3 - length4 };
		double interTubeData[4] = { diam3, diam1 - 2 * size, (length1 - length2 - length3 - length4) / 2, 0 };
		double angles[2] = { 0, 270 };
		if( diam3 <= diam1 ) {
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n[0], false);
		} else {
			p1.set(-length1 / 2, 0, 0);
			p2.set(-length1 / 2 + (tubeData[1] - diam3) / 2, 0, 0);
			makeSimpleTube(p1, p2, diam1, diam3, n[0]);

			p1.x = p2.x + diam3;
			p2.x = p1.x + (tubeData[1] - diam3) / 2;
			makeSimpleTube(p1, p2, diam3, diam1, n[0]);

			p1.set(-length1 / 2 + (tubeData[1] - diam3) / 2, 0, 0);
			tubeData[0] = diam3;
			tubeData[1] = diam3;
			interTubeData[2] = diam3 / 2;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n[0], false);
		}

		FdPoint3d rp;
		rp.set(-length1 / 2, 0, 0);
		makeFlatRing(rp, vx, diam1, diam1 - 2 * size, n[0]);

		rp.set( length1 / 2, 0, 0);
		makeFlatRing(rp, vx, diam2, diam2 - 2 * size, n[0]);

		rp.set(-length1 / 2 + (length1 - length2 - length3 - length4) / 2, diam1 - 2 * size, 0);
		makeFlatRing(rp, vy, diam3, diam3 - 2 * size, n[0]);
	}

	/**********************************Recover variables*******************************/
	length1 = copylength1; length2 = copylength2;  length3 = copylength3; length4 = copylength4;
		 diam1 = copydiam1;  diam2 = copydiam2;  diam3 = copydiam3;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setMeshColor(3);
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		diam1 -= 2 * size;
		diam2 -= 2 * size;
		diam3 -= 2 * size;
		// makeARE(l1, l1 - l4, 0, 0, d1, d2, d3, n);

		FdPoint3d p1, p2, p3, p4;
		FdPoint3d centers[4];
		double diams[4];  // for the reducer diameters...this function takes only a 1D array
		int numOfSegs = 3;

		// if the intersecting tube's diameter is less than the main tube's, then this is
		// 2 calls...once to makeTubeIntersection() and once to makeStraightTube()...however, if the intersecting
		// tube's diameter is greater than or equal to the main tube's, then we call makeOptTubeIntersection() and makeStraightTube()

		// MAKE REDUCER
		p1.set(length1 / 2 - length2 - length3 - length4, 0, 0);
		centers[0] = p1;
		diams[0] = diam1;
		
		if( length3 == 0 ) {
			numOfSegs--;
			diams[1] = diam2;
			p2.set(length1 / 2 - length4, 0, 0);
			centers[1] = p2;
		} else {
			diams[1] = diam1;
			diams[2] = diam2;
			p2.set(length1 / 2 - length2 - length4, 0, 0);
			centers[1] = p2;
			p3.set(length1 / 2 - length4, 0, 0);
			centers[2] = p3;
		}

		if( length4 == 0 ) {
			numOfSegs--;
		} else {
			if( length3 == 0 ) {
				diams[2] = diam2;
				p3.set(length1 / 2, 0, 0);
				centers[2] = p3;
			} else {
				diams[3] = diam2;
				p4.set(length1 / 2, 0, 0);
				centers[3] = p4;
			}
		}
		makeStraightTube(centers, diams, n[0], numOfSegs, true);

		// MAKE TUBE INTERSECTION
		p1.set(-length1 / 2, 0, 0);

		double tubeData[2] = { diam1, length1 - length2 - length3 - length4 };
		double interTubeData[4] = { diam3, diam1 + 2 * size, (length1 - length2 - length3 - length4) / 2, 0 };
		double angles[2] = { 0, 270 };
		if( diam3 <= diam1 ) {
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n[0], false);
		} else {
			p1.set(-length1 / 2, 0, 0);
			p2.set(-length1 / 2 + (tubeData[1] - diam3) / 2, 0, 0);
			makeSimpleTube(p1, p2, diam1, diam3, n[0]);

			p1.x = p2.x + diam3;
			p2.x = p1.x + (tubeData[1] - diam3) / 2;
			makeSimpleTube(p1, p2, diam3, diam1, n[0]);

			p1.set(-length1 / 2 + (tubeData[1] - diam3) / 2, 0, 0);
			tubeData[0] = diam3;
			tubeData[1] = diam3;
			interTubeData[2] = diam3 / 2;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n[0], false);
		}

		FdPoint3d rp;
		rp.set(-length1 / 2, 0, 0);
		makeFlatRing(rp, vx, diam1, diam1 + 2 * size, n[0]);

		rp.set( length1 / 2, 0, 0);
		makeFlatRing(rp, vx, diam2, diam2 + 2 * size, n[0]);
		
		rp.set(-length1 / 2 + (length1 - length2 - length3 - length4) / 2, diam1 + 2 * size, 0);
		makeFlatRing(rp, vy, diam3, diam3 + 2 * size, n[0]);
	}

	/**********************************Recover variables*******************************/
	length1 = copylength1; length2 = copylength2;  length3 = copylength3; length4 = copylength4;
		 diam1 = copydiam1;  diam2 = copydiam2;  diam3 = copydiam3;


	//--- If intersecting diam >= main, we actually get ellipses at the saddle of the intersection,
	//--- not splines, so we must remember to specify that these should be thin.
	if( diam3 >= diam1 )
		p1.set(-length1 / 2 + (length1 - length2 - length3 - length4) / 2, 0, 0);
	drawAsThinArc(p1);

	//---add HLR info
	setHlrSplineType(hlrThin);
	p1.set(-length1 / 2, 0, 0);
	p2.set( length1 / 2, 0, 0);
	addCenterLine(p1, p2);

	p1.set(-length1 / 2 + (length1 - length2 - length3 - length4) / 2, 0, 0);
	p2.set(-length1 / 2 + (length1 - length2 - length3 - length4) / 2, diam1, 0);
	addCenterLine(p1, p2);

	p1.set(-length1 / 2, 0, 0);
	addCircularConnector(p1);

	p1.set( length1 / 2, 0, 0);
	addCircularConnector(p1);

	p1.set(-length1 / 2 + (length1 - length2 - length3 - length4) / 2, diam1, 0);
	addCircularConnector(p1);

	p1.set(-length1 / 2 + (length1 - length2 - length3 - length4), 0, 0);
	drawAsThinArc(p1);
}

void GLECircular::makeBGE(double diam1, double ratio, double angle, int n, int segmentation)
{	
	/**********************************GEOMETRY*************************************/
	
	//---Make sure the spline that results if an HLR is done
	//---from a angled (non-orthogonal) view is red.
	setHlrSplineType(hlrOutline);

	double radius = diam1 * ratio;
	double rang = M_PI * angle / 180.0;
	double x = radius - (radius - diam1 / 2.0) * (1 - cos(rang)) / 2.0;
	double y = (radius + diam1 / 2.0) * sin(rang) / 2.0;
	FdPoint3d p1(x, -y,  0 ), p2;
	makeDonutSection(p1, -vz, -vx, radius, diam1, angle, n, segmentation);

	//---specify the two connectors
	p1.set(x - radius, -y, 0);
	addCircularConnector(p1);

	p1.set(x - cos(rang) * radius, -y + sin(rang) * radius, 0);
	addCircularConnector(p1);

	p1.set(x , -y, 0);
	addCenterArc(p1, -vz, -vx, diam1 * ratio, 0, rang);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1 , copyratio = ratio, copyangle = angle ;
	
	/**********************************Ext Insulation*******************************/
	double size;
	if ( getExtInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		diam1 += 2 * size;
		
		double radius = (diam1 - 2 * size) * ratio;
		double x = radius - (radius - (diam1 - 2 * size) / 2.0) * (1 - cos(rang)) / 2.0;
		double y = (radius + (diam1 - 2 * size) / 2.0) * sin(rang) / 2.0;
		FdPoint3d p1(x, -y,  0 ), p2(0, 0, 0);
		makeDonutSection(p1, -vz, -vx, radius, diam1, angle, n, segmentation);
		
		p1.set(x - radius, -y, 0);
		makeFlatRing(p1, vy, diam1, diam1 - 2 * size, n);
		
		p2.set(x - cos(rang) * radius, -y + sin(rang) * radius, 0);
		FdVector3d rotv = vy;
		rotv.rotateBy(-rang,vz);
		makeFlatRing(p2, rotv, diam1, diam1 - 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copyratio = ratio;  copyangle = angle;

	/***********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setMeshColor(3);
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		diam1 -= 2 * size;

		double radius = (diam1 + 2 * size) * ratio;
		double x = radius - (radius - (diam1 + 2 * size) / 2.0) * (1 - cos(rang)) / 2.0;
		double y = (radius + (diam1 + 2 * size) / 2.0) * sin(rang) / 2.0;
		FdPoint3d p1(x, -y,  0 ), p2(0, 0, 0);
		makeDonutSection(p1, -vz, -vx, radius, diam1, angle, n, segmentation);

		p1.set(x - radius, -y, 0);
		makeFlatRing(p1, vy, diam1, diam1 + 2 * size, n);

		p2.set(x - cos(rang) * radius, -y + sin(rang) * radius, 0);
		FdVector3d rotv = vy;
		rotv.rotateBy(-rang,vz);
		makeFlatRing(p2, rotv, diam1, diam1 + 2 * size, n);
	}
}

void GLECircular::makeBSE(double diam1, double ratio, double angle, int n, int segmentation)
{
	/**********************************GEOMETRY*************************************/
	
	FdPoint3d p1,p2;
	double radius = diam1 * ratio;
	double rang = M_PI * angle / 180.0;
	double x = radius - (radius - diam1 / 2.0) * (1 - cos(rang)) / 2.0;
	double y = (radius + diam1 / 2.0) * sin(rang) / 2.0;
	p1.set(x, -y,  0);
	makeTubularBend(p1, -vz, -vx, radius, diam1, angle, n, segmentation, true);

	//---specify the two connectors
	p1.set(x - radius, -y, 0);
	addCircularConnector(p1);
	
	p1.set(x - cos(rang) * radius, -y + sin(rang) * radius, 0);
	addCircularConnector(p1);


	//---draw each circular segment joint as thin, and add the center lines for all but last segment
	double inc = angle / segmentation;
	FdPoint3d rotPoint1 ( x - radius, -y, 0 );
	FdPoint3d clPoint ( x - radius, -y, 0 );
	
	p1.set(x, -y, 0);
	rotPoint1 = rotPoint1.rotateBy(inc * M_PI / 180, -vz, p1);

	for( int i = 0; i < segmentation - 1; i++ )
	{
		drawAsThinArc(rotPoint1);
		addCenterLine(clPoint, rotPoint1);

		p1.set(x, -y, 0);
		rotPoint1 = rotPoint1.rotateBy(inc * M_PI / 180, -vz, p1);
		clPoint = clPoint.rotateBy(inc * M_PI / 180, -vz, p1);
	};

	//---add one more center line for the last segment
	addCenterLine(clPoint, rotPoint1);


	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copyratio = ratio, copyangle = angle;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		FdPoint3d p1,p2, p3;
		diam1 += 2 * size;
		double radius = (diam1 - 2 * size) * ratio;
		double x = radius - (radius - (diam1 - 2 * size) / 2.0) * (1 - cos(rang)) / 2.0;
		double y = (radius + (diam1 - 2 * size) / 2.0) * sin(rang) / 2.0;
		p1.set(x, -y,  0);
		makeTubularBend(p1, -vz, -vx, radius, diam1, angle, n, segmentation, true);

		//---specify the two connectors
		p1.set(x - radius, -y, 0);
		makeFlatRing(p1, vy, diam1, diam1 - 2 * size, n);

		p1.set(x - cos(rang) * radius, -y + sin(rang) * radius, 0);
		FdVector3d rotv = vy;
		rotv.rotateBy(-rang, vz);
		makeFlatRing(p1, rotv, diam1, diam1 - 2 * size, n);		
	}

	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copyratio = ratio;  copyangle = angle;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		FdPoint3d p1,p2, p3;
		diam1 -= 2 * size;
		double radius = (diam1 + 2 * size) * ratio;
		double x = radius - (radius - (diam1 + 2 * size) / 2.0) * (1 - cos(rang)) / 2.0;
		double y = (radius + (diam1 + 2 * size) / 2.0) * sin(rang) / 2.0;
		p1.set(x, -y,  0);
		makeTubularBend(p1, -vz, -vx, radius, diam1, angle, n, segmentation, true);

		p1.set(x - radius, -y, 0);
		makeFlatRing(p1, vy, diam1, diam1 + 2 * size, n);
		
		p1.set(x - cos(rang) * radius, -y + sin(rang) * radius, 0);
		FdVector3d rotv = vy;
		rotv.rotateBy(-rang, vz);
		makeFlatRing(p1, rotv, diam1, diam1 + 2 * size, n);		
	}
}

void GLECircular::makeCP1(double length1, double length2, double length3, double diam1, double diam2, int n)
{
	/**********************************GEOMETRY*************************************/

	//--- make sure the spline that results from the "saddle" where the 
	//--- two tubes intersect is drawn as thin
	setHlrSplineType(hlrThin);

	FdPoint3d p1, p2;
	p1.set(-(length1 + length3 * 2) / 2, 0, 0);
	double tubeData[2];
	double interTubeData[4];
	double angles[2];
	if( diam2 <= diam1 ) {
		// define the directional vector for both tee intersection functions

		tubeData[0] = diam1;
		tubeData[1] = length1 + length3 * 2;
		interTubeData[0] = diam2;
		interTubeData[1] = length2;
		interTubeData[2] = tubeData[1] / 2;
		interTubeData[3] = -(diam1 - diam2) / 2;
		angles[0] = 0;
		angles[1] = 270;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);
		angles[1] = 90;
		interTubeData[3] = (diam1 - diam2) / 2;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);

		//--- if the two tubes have equal diameter, there are two ellipses (not splines)
		//--- that define the intersection (saddle), so we must explicitly define these as thin
		if( diam2 == diam1 )
		{
			p1.set(0, 0, 0);
			drawAsThinArc(p1);
		}
	} else {
		// define the directional vector for both tee intersection functions

		p1.set(0, -length2, -(diam2 - diam1) / 2);
		tubeData[0] = diam2;
		tubeData[1] = length2 * 2;
		interTubeData[0] = diam1;
		interTubeData[1] = length1 / 2 + length3;
		interTubeData[2] = tubeData[1] / 2;
		interTubeData[3] = (diam1 - diam2) / 2;
		angles[0] = 0;
		angles[1] = 270;
		 makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
		angles[1] = 90;
		interTubeData[3] = -(diam1 - diam2) / 2;
		 makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
	}

	/****************************Copy/create Insulation vairables*******************/
	double copylength1 = length1, copylength2 = length2, copylength3 = length3, copydiam1 = diam1, copydiam2 = diam2; 
	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		//--- make sure the spline that results from the "saddle" where the
		//--- two tubes intersect is drawn as thin
		diam1 += 2 * size;
		diam2 += 2 * size;
		setHlrSplineType(hlrThin);

		FdPoint3d p1, p2;
		p1.set(-(length1 + length3 * 2) / 2, 0, 0);
		double tubeData[2];
		double interTubeData[4];
		double angles[2];
		if( diam2 <= diam1 ) {
			// define the directional vector for both tee intersection functions
			tubeData[0] = diam1;
			tubeData[1] = length1 + length3 * 2;
			interTubeData[0] = diam2;
			interTubeData[1] = length2;
			interTubeData[2] = tubeData[1] / 2;
			interTubeData[3] = -(diam1 - diam2) / 2;
			angles[0] = 0;
			angles[1] = 270;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);
			angles[1] = 90;
			interTubeData[3] = (diam1 - diam2) / 2;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);

			//--- if the two tubes have equal diameter, there are two ellipses (not splines)
			//--- that define the intersection (saddle), so we must explicitly define these as thin
			if( diam2 == diam1 )
			{
				p1.set(0, 0, 0);
				drawAsThinArc(p1);
			}
		} else {
			// define the directional vector for both tee intersection functions
			p1.set(0, -length2, -(diam2 - diam1) / 2);
			tubeData[0] = diam2;
			tubeData[1] = length2 * 2;
			interTubeData[0] = diam1;
			interTubeData[1] = length1 / 2 + length3;
			interTubeData[2] = tubeData[1] / 2;
			interTubeData[3] = (diam1 - diam2) / 2;
			angles[0] = 0;
			angles[1] = 270;
			makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
			angles[1] = 90;
			interTubeData[3] = -(diam1 - diam2) / 2;
			makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
		}

		p1.set(0, -length2, (diam1 - diam2) / 2);
		makeFlatRing(p1, vy, diam2, diam2 - 2 * size, n);

		p1.set(0,  length2, (diam1 - diam2) / 2);
		makeFlatRing(p1, vy, diam2, diam2 - 2 * size, n);

		p1.set(-(length1 + length3 * 2) / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 - 2 * size, n);

		p1.set((length1 + length3 * 2) / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 - 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copylength1 = length1;  copylength2 = length2;  copylength3 = length3;  copydiam1 = diam1;  copydiam2 = diam2;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setMeshColor(3);
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		//--- make sure the spline that results from the "saddle" where the 
		//--- two tubes intersect is drawn as thin
		diam1 -= 2 * size;
		diam2 -= 2 * size;
		setHlrSplineType(hlrThin);

		FdPoint3d p1, p2;
		p1.set(-(length1 + length3 * 2) / 2, 0, 0);
		double tubeData[2];
		double interTubeData[4];
		double angles[2];
		if( diam2 <= diam1 ) {
			// define the directional vector for both tee intersection functions

			tubeData[0] = diam1;
			tubeData[1] = length1 + length3 * 2;
			interTubeData[0] = diam2;
			interTubeData[1] = length2;
			interTubeData[2] = tubeData[1] / 2;
			interTubeData[3] = -(diam1 - diam2) / 2;
			angles[0] = 0;
			angles[1] = 270;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);
			angles[1] = 90;
			interTubeData[3] = (diam1 - diam2) / 2;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);

			//--- if the two tubes have equal diameter, there are two ellipses (not splines)
			//--- that define the intersection (saddle), so we must explicitly define these as thin
			if( diam2 == diam1 )
			{
				p1.set(0, 0, 0);
				drawAsThinArc(p1);
			}
		} else {
			// define the directional vector for both tee intersection functions
			p1.set(0, -length2, -(diam2 - diam1) / 2);
			tubeData[0] = diam2;
			tubeData[1] = length2 * 2;
			interTubeData[0] = diam1;
			interTubeData[1] = (length1 / 2 + length3);
			interTubeData[2] = tubeData[1] / 2;
			interTubeData[3] = (diam1 - diam2) / 2;
			angles[0] = 0;
			angles[1] = 270;
			makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
			angles[1] = 90;
			interTubeData[3] = -(diam1 - diam2) / 2;
			makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
		}

		p1.set(0, -length2, (diam1 - diam2) / 2);
		makeFlatRing(p1, vy, diam2, diam2 + 2 * size, n);

		p1.set(0,  length2, (diam1 - diam2) / 2);
		makeFlatRing(p1, vy, diam2, diam2 + 2 * size, n);

		p1.set(-(length1 + length3 * 2) / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 + 2 * size, n);

		p1.set( (length1 + length3 * 2) / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 + 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copylength1 = length1;  copylength2 = length2;  copylength3 = length3;  copydiam1 = diam1;  copydiam2 = diam2;

	//--- add two center lines for both tube axes
	p1.set(-length1 / 2, 0, 0);
	p2.set( length1 / 2, 0, 0);
	addCenterLine(p1, p2);

	p1.set(0, -length2, (diam1 - diam2) / 2);
	p2.set(0,  length2, (diam1 - diam2) / 2);
	addCenterLine(p1, p2);

	//--- add two circular connectors for the main tube
	p1.set(-length1 / 2, 0, 0);
	addCircularConnector(p1);

	p1.set( length1 / 2, 0, 0);
	addCircularConnector(p1);

	//--- add two circular connectors for the intersecting tube
	p1.set(0,  length2, (diam1 - diam2) / 2);
	addCircularConnector(p1);

	p1.set(0, -length2, (diam1 - diam2) / 2);
	addCircularConnector(p1);
}

void GLECircular::makeDFA(double diam1, double length1, double size, int n)
{
	/**********************************GEOMETRY*************************************/
	FdPoint3d p1(-length1, 0, 0), p2(0, 0, 0);
	FdPoint3d centers[3] = { p1, p2, p2 };
	double diams[3] = { diam1, diam1, diam1 + size * 2 };
	makeStraightTube(centers, diams, n, 2, true);

	//--- Add Hlr Info.
	addCircularConnector(centers[0]);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copylength1 = length1;

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		diam1 += size;

		FdPoint3d p1(-length1 / 2, 0, 0), p2(length1 / 2, 0, 0);
		FdPoint3d centers[3] = { p1, p2, p2 };
		double diams[3] = { diam1, diam1, diam1 + size * 2 };
		makeStraightTube(centers, diams, n, 1, true);

		makeFlatRing(p1, vx, diam1, diam1 - size, n);
	}
	
	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copylength1 = length1;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setMeshColor(3);
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		diam1 -= size;
		
		FdPoint3d p1(-length1, 0, 0), p2(0, 0, 0);
		FdPoint3d centers[3] = { p1, p2, p2 };
		double diams[3] = { diam1, diam1, diam1 + size * 2 };
		makeStraightTube(centers, diams, n, 1, true);

		makeFlatRing(p1, vx, diam1, diam1 + size, n);
		makeFlatRing(p2, vx, diam1, diam1 + size, n);
	}
}

void GLECircular::makeDRE(double diam1, double length1, double size, int n)
{
	/**********************************GEOMETRY*************************************/
	FdPoint3d p1(length1, 0, 0), p2(length1, 0, 0);
	FdPoint3d centers[3] = { p1, p2, p2 };
	double diams[3] = { diam1, diam1, diam1 + size * 2 };
	makeStraightTube(centers, diams, n, 2, true);

	//--- Add Hlr Info.
	addCircularConnector(centers[0]);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copylength1 = length1;

	/**********************************Ext Insulation*******************************/
	if( getExtInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		diam1 += size;

		FdPoint3d p1(length1, 0, 0), p2(0, 0, 0);
		FdPoint3d centers[3] = { p1, p2, p2 };
		double diams[3] = { diam1, diam1, diam1 + size * 2 };
		makeStraightTube(centers, diams, n, 1, true);

		makeFlatRing(p1, vx, diam1, diam1 - size, n);
	}
	
	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copylength1 = length1;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setMeshColor(3);
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		diam1 -= size;

		FdPoint3d p1(-length1, 0, 0), p2(0, 0, 0);
		FdPoint3d centers[3] = { p1, p2, p2 };
		double diams[3] = { diam1, diam1, diam1 + size * 2 };
		makeStraightTube(centers, diams, n, 1, true);

		makeFlatRing(p1, vx, diam1, diam1 + size, n);
		makeFlatRing(p2, vx, diam1, diam1 + size, n);
	}
}

void GLECircular::makeHSE(double diam1, double diam2, double length1, double angle, int n)
{
	
	/**********************************GEOMETRY*************************************/	
	double
		rootRadius   = diam1 / 2,                                            // Radius of the base sphere.
		rotAlpha     = (angle * (M_PI / 180)) / 2,                           // Degrees => radians of the input angle/2.
		height       = length1 * cos(rotAlpha) + diam2 * sin(rotAlpha) / 2,  // Total height of the intersection.
		lats[2]      = { 90, 180 },                                          // Latitudinal sweep of the base sphere.
		longs[2]     = { 0,  360 },                                          // Longitudinal sweep of the base sphere.
		startDiam    = rootRadius / cos(rotAlpha),					         // Diameter of the forks where they touch the sphere.
		sphDiams[3]  = { tan(rotAlpha) * diam1, diam1, diam1 },              // The three axis lengths of the base sphere.
		forkDiams[2] = {startDiam, diam2 };                                  // The beg and end diameters for the two forks.
	int complex[2]   = { n, n * 2 };                                         // The number of faces of which the sphere is composed.

	//--- Find the end points of the "left and right" Y branches,
	//--- and the center of the hemisphere forming the base.
	FdPoint3d
		sphereCenter = FdPoint3d::kOrigin - vx * (height/2),
		leftForkEnd  = sphereCenter + vx * length1,
		rightForkEnd = sphereCenter + vx * length1;
	leftForkEnd.rotateBy  (  rotAlpha, vz, sphereCenter );
	rightForkEnd.rotateBy ( -rotAlpha, vz, sphereCenter );

	//--- Find the beginning points of the "left and right" branches.
	//--- These branches will rest on the surface of the hemisphere.
	FdPoint3d
		leftForkBeg  = sphereCenter + xVec * sphDiams[0] / 4 + yVec * sphDiams[1] / 4,
		rightForkBeg = sphereCenter + xVec * sphDiams[0] / 4 - yVec * sphDiams[1] / 4;

	//--- Call geometry primitives to make the hemisphere and two branching tubes.
	FdPoint3d points[2] = {leftForkBeg, leftForkEnd};
	makeUniVectorTube(points, (leftForkEnd - sphereCenter).normalize(), forkDiams, n, 1);
	points[0] = rightForkBeg;  points[1] = rightForkEnd;
	makeUniVectorTube(points, (rightForkEnd - sphereCenter).normalize(), forkDiams, n, 1);
	makeSpheroidSection(sphereCenter, vx, lats, longs, sphDiams, complex);

	//--- Add Hlr info.
	addCircularConnector(leftForkEnd);
	addCircularConnector(rightForkEnd);
	addCircularConnector(sphereCenter, vx);
	drawAsThinArc(leftForkBeg);
	drawAsThinArc(rightForkBeg);
	addCenterLine(sphereCenter, leftForkEnd);
	addCenterLine(sphereCenter, rightForkEnd);
	setHlrSplineType(hlrThin);

	// *Add a normal for the connector so the sphere silhouette
	//  isn't colored as a connector, only the sphere's "equator".
	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copydiam2 = diam2, copylength1 = length1, copyangle = angle;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		diam1 += 2 * size;
		diam2 += 2 * size;

		double
			rootRadius   = diam1 / 2,                                            // Radius of the base sphere.
			rotAlpha     = (angle * (M_PI / 180)) / 2,                           // Degrees => radians of the input angle/2.
			height       = length1 * cos(rotAlpha) + (diam2 - 2 * size) * sin(rotAlpha) / 2,  // Total height of the intersection.
			lats[2]      = { 90, 180 },                                          // Latitudinal sweep of the base sphere.
			longs[2]     = { 0,  360 },                                          // Longitudinal sweep of the base sphere.
			startDiam    = rootRadius / cos(rotAlpha),					         // Diameter of the forks where they touch the sphere.
			sphDiams[3]  = { tan(rotAlpha) * diam1, diam1, diam1 },              // The three axis lengths of the base sphere.
			forkDiams[2] = { startDiam, diam2 };                                 // The beg and end diameters for the two forks.
		int complex[2]   = { n, n * 2 };                                         // The number of faces of which the sphere is composed.

		//--- Find the end points of the "left and right" Y branches,
		//--- and the center of the hemisphere forming the base.
		FdPoint3d
			sphereCenter = FdPoint3d::kOrigin - vx * (height / 2),
			leftForkEnd  = sphereCenter + vx * length1,
			rightForkEnd = sphereCenter + vx * length1;
		leftForkEnd.rotateBy ( rotAlpha, vz, sphereCenter);
		rightForkEnd.rotateBy(-rotAlpha, vz, sphereCenter);

		//--- Find the beginning points of the "left and right" branches.
		//--- These branches will rest on the surface of the hemisphere.
		FdPoint3d
			leftForkBeg  = sphereCenter + xVec * sphDiams[0] / 4 + yVec * sphDiams[1] / 4,
			rightForkBeg = sphereCenter + xVec * sphDiams[0] / 4 - yVec * sphDiams[1] / 4;

		//--- Call geometry primitives to make the hemisphere and two branching tubes.
		FdPoint3d points[2] = { leftForkBeg, leftForkEnd };
		makeUniVectorTube(points, (leftForkEnd - sphereCenter).normalize(), forkDiams, n, 1);
		points[0] = rightForkBeg;  points[1] = rightForkEnd;
		makeUniVectorTube(points, (rightForkEnd - sphereCenter).normalize(), forkDiams, n, 1);
		makeSpheroidSection(sphereCenter, vx, lats, longs, sphDiams, complex);

		makeFlatRing(sphereCenter, vx, diam1, diam1 - 2 * size, n);
		makeFlatRing(leftForkEnd, leftForkEnd - sphereCenter, diam2, diam2 - 2 * size, n);
		makeFlatRing(rightForkEnd, rightForkEnd - sphereCenter, diam2, diam2 - 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copydiam2 = diam2;  copylength1 = length1;  copyangle = angle;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		setMeshColor(3);

		diam1 -= 2 * size;
		diam2 -= 2 * size;

		double
			rootRadius   = diam1 / 2,                                            // Radius of the base sphere.
			rotAlpha     = (angle * (M_PI / 180)) / 2,                           // Degrees => radians of the input angle/2.
			height       = length1 * cos(rotAlpha) + (diam2 + 2 * size) * sin(rotAlpha) / 2,  // Total height of the intersection.
			lats[2]      = { 90, 180 },                                          // Latitudinal sweep of the base sphere.
			longs[2]     = { 0,  360 },                                          // Longitudinal sweep of the base sphere.
			startDiam    = rootRadius / cos(rotAlpha),					         // Diameter of the forks where they touch the sphere.
			sphDiams[3]  = { tan(rotAlpha) * diam1, diam1, diam1 },              // The three axis lengths of the base sphere.
			forkDiams[2] = { startDiam, diam2 };                                 // The beg and end diameters for the two forks.
		int complex[2]   = { n, n * 2 };                                         // The number of faces of which the sphere is composed.

		//--- Find the end points of the "left and right" Y branches,
		//--- and the center of the hemisphere forming the base.
		FdPoint3d
			sphereCenter = FdPoint3d::kOrigin - vx * (height / 2),
			leftForkEnd  = sphereCenter + vx * length1,
			rightForkEnd = sphereCenter + vx * length1;
		leftForkEnd.rotateBy ( rotAlpha, vz, sphereCenter);
		rightForkEnd.rotateBy(-rotAlpha, vz, sphereCenter);

		//--- Find the beginning points of the "left and right" branches.
		//--- These branches will rest on the surface of the hemisphere.
		FdPoint3d
			leftForkBeg  = sphereCenter + xVec * sphDiams[0] / 4 + yVec * sphDiams[1] / 4,
			rightForkBeg = sphereCenter + xVec * sphDiams[0] / 4 - yVec * sphDiams[1] / 4;

		//--- Call geometry primitives to make the hemisphere and two branching tubes.
		FdPoint3d points[2] = { leftForkBeg, leftForkEnd };
		makeUniVectorTube(points, (leftForkEnd - sphereCenter).normalize(), forkDiams, n, 1);
		points[0] = rightForkBeg;  points[1] = rightForkEnd;
		makeUniVectorTube(points, (rightForkEnd - sphereCenter).normalize(), forkDiams, n, 1);
		makeSpheroidSection(sphereCenter, vx, lats, longs, sphDiams, complex);

		makeFlatRing(sphereCenter, vx, diam1, diam1 + 2 * size, n);
		makeFlatRing(leftForkEnd, leftForkEnd - sphereCenter, diam2, diam2 + 2 * size, n);
		makeFlatRing(rightForkEnd, rightForkEnd - sphereCenter, diam2, diam2 + 2 * size, n);
	}

}

void GLECircular::makeKXE(double length1, double length2, double length3, double diam1, double diam2, int n)
{
	//---make sure the spline that results from the "saddle" where the 
	//---two tubes intersect is drawn as thin
	setHlrSplineType(hlrThin);
	
	if(diam2<=diam1){

		FdPoint3d p1(-(length1+length3*2)/2,0,0);
		double tubeData[2] = {diam1, length1 + length3*2};
		double interTubeData[4]= {diam2, length2, tubeData[1]/2, 0};
		double angles[2] = {0,270};
			
		 makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);
		angles[1] = 90;
		 makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);

		//---if the two tubes have equal diameter, there are two ellipses (not splines)
		//---that define the intersection, so we must explicitly define these as thin
		 if(diam2==diam1) drawAsThinArc(FdPoint3d::kOrigin);

	}else{

		FdPoint3d p1(0, -(length2), 0);
		double tubeData[2] = {diam2, length2*2};
		double interTubeData[4] = {diam1, (length1/2+length3), tubeData[1]/2, 0};
		double angles[2] = {0 ,270};
		
		//define the directional vector for both tee intersection functions
		 makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
		angles[1] = 90;
		 makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);

	}
	//---add two center lines
	FdPoint3d p1, p2;
	p1.set(-length1/2, 0, 0);
	p2.set(length1/2, 0, 0);
	addCenterLine(p1, p2);

	p1.set(0, -length2, 0);
	p2.set(0, length2, 0);
	addCenterLine(p1, p2);

	//---add two circular connectors for the main tube
	p1.set(-length1/2, 0, 0);
	addCircularConnector(p1);

	p1.set(length1/2, 0, 0);
	addCircularConnector(p1);

	//---add two circular connectors for the intersecting tube
	p1.set(0, length2, 0);
	addCircularConnector(p1);

	p1.set(0, -length2, 0);
	addCircularConnector(p1);

	/****************************Copy/create Insulation vairables*******************/
	double copylength1 = length1, copylength2 = length2, copylength3 = length3, copydiam1 = diam1, copydiam2 = diam2;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);

		diam1 += 2 * size;  diam2 += 2 * size;

		FdPoint3d p1;
		if( diam2 <= diam1 )
		{
			p1.set( -(length1+length3*2)/2,0,0 );
			double tubeData[2] = {diam1, length1 + length3*2};
			double interTubeData[4]= {diam2, length2, tubeData[1]/2, 0};
			double angles[2] = {0,270};
				
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);
			angles[1] = 90;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);				
		}
		else
		{
			p1.set(0, -(length2), 0);
			double tubeData[2] = {diam2, length2*2};
			double interTubeData[4] = {diam1, (length1/2+length3), tubeData[1]/2, 0};
			double angles[2] = {0 ,270};
			
			//define the directional vector for both tee intersection functions
			makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
			angles[1] = 90;
			makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
		}	

		p1.set( -(length1+length3*2)/2,0,0 );
		makeFlatRing(p1, vx, diam1, diam1 - 2*size, n);

		p1.x += length1 + length3*2;
		makeFlatRing(p1, vx, diam1, diam1 - 2*size, n);

		p1.set( -(length1+length3*2)/2 + (length1 + length3*2)/2, length2, 0 ); 
		makeFlatRing(p1, vy, diam2, diam2 - 2*size, n);
		
        p1.set( -(length1+length3*2)/2 + (length1 + length3*2)/2, -length2, 0 ); 
		makeFlatRing(p1, vy, diam2, diam2 - 2*size, n);			
	}

	/**********************************Recover variables*******************************/
	length1 = copylength1, length2 = copylength2, length3 = copylength3, diam1 =copydiam1,  diam2 = copydiam2;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		diam1 -= 2 * size;  diam2 -= 2 * size;

		FdPoint3d p1;
		if( diam2 <= diam1 )
		{
			p1.set( -(length1+length3*2)/2,0,0 );
			double tubeData[2] = {diam1, length1 + length3*2};
			double interTubeData[4]= {diam2, length2, tubeData[1]/2, 0};
			double angles[2] = {0,270};
				
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);
			angles[1] = 90;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, true);				
		}
		else
		{
			p1.set(0, -(length2), 0);
			double tubeData[2] = {diam2, length2*2};
			double interTubeData[4] = {diam1, (length1/2+length3), tubeData[1]/2, 0};
			double angles[2] = {0 ,270};

			// define the directional vector for both tee intersection functions
			makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
			angles[1] = 90;
			makeTubeToTubeIntersection2(p1, vy, tubeData, interTubeData, angles, n, true);
		}

		p1.set( -(length1+length3*2)/2,0,0 );
		makeFlatRing(p1, vx, diam1, diam1 + 2*size, n);

		p1.x += length1 + length3*2;
		makeFlatRing(p1, vx, diam1, diam1 + 2*size, n);

		p1.set( -(length1+length3*2)/2 + (length1 + length3*2)/2, length2, 0 ); 
		makeFlatRing(p1, vy, diam2, diam2 + 2*size, n);
		
        p1.set( -(length1+length3*2)/2 + (length1 + length3*2)/2, -length2, 0 ); 
		makeFlatRing(p1, vy, diam2, diam2 + 2*size, n);			
	}
}

void GLECircular::makeMFA(double diam1, double length1, int n)
{
	//--- One simple cylindrical tube.
	FdPoint3d p1(-length1/2, 0, 0), p2(length1 / 2, 0, 0);
	FdPoint3d centers[2] = { p1, p2 };
	makeVerySimpleTube(centers, diam1, n);

	//--- Add two thin circles to represent sleeves.
	FdPoint3d center(-7.5, 0, 0);  FdVector3d normal(1, 0, 0);
	addThinCircle(center, normal, diam1);
	center.x = 7.5;
	addThinCircle(center, normal, diam1);

	//--- Add two connectors.
	p1.set(-length1/2, 0, 0);
	addCircularConnector(p1);

	p1.set(length1/2, 0, 0);
	addCircularConnector(p1);

	//--- Add center line for tube axis.
	p1.set(-length1/2, 0, 0);
	p2.set(length1/2, 0, 0);
	addCenterLine(p1, p2);
	
   	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copylength1 = length1;
	
	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		
		diam1 += 2*size;

		//--- One simple cylindrical tube.
		FdPoint3d p1(-length1/2, 0, 0), p2(length1 / 2, 0, 0);
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);

		makeFlatRing(p1, vx, diam1, diam1 - 2 * size, n);
		makeFlatRing(p2, vx, diam1, diam1 - 2 * size, n);	
	}
	
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		diam1 -= 2*size;

		//--- One simple cylindrical tube.
		FdPoint3d p1(-length1/2, 0, 0), p2(length1 / 2, 0, 0);
		FdPoint3d centers[2] = { p1, p2 };
		makeVerySimpleTube(centers, diam1, n);

		makeFlatRing(p1, vx, diam1, diam1 + 2 * size, n);
		makeFlatRing(p2, vx, diam1, diam1 + 2 * size, n);	
	}
}

void GLECircular::makeOC1(double diam1, double length1, double length2, double e, int n)
{
	/**********************************GEOMETRY*************************************/
	//--- Since this is an elbow jointed tube, we can
	//--- simply use the derived function of makeTube().
	FdPoint3d p1, p2, p3, p4;
	p1.set( -length1 / 2.0, 0, 0);
	p2.set( -length1/2.0 + length2, 0, 0 );
	p3.set(length1/2.0 - length2, e, 0);
	p4.set(length1/2.0, e, 0);
	FdPoint3d p[4] = {p1, p2, p3, p4};
	
	makeElbowedTube(p, diam1, n, 3, true);

	//--- Add Hlr curve info.
	addCenterPolyLine(p, 3);
	addCircularConnector(p1);
	addCircularConnector(p4);
	drawAsThinArc(p2);
	drawAsThinArc(p3);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copylength1 = length1, copylength2 = length2, copye = e;
	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		setMeshColor(1);
		diam1 += 2 * size;

		FdPoint3d p1, p2, p3, p4;
		p1.set(-length1 / 2.0,           0, 0);
		p2.set(-length1 / 2.0 + length2, 0, 0 );
		p3.set( length1 / 2.0 - length2, e, 0);
		p4.set( length1 / 2.0,           e, 0);
		FdPoint3d p[4] = { p1, p2, p3, p4 };

		makeElbowedTube(p, diam1, n, 3, true);
		makeFlatRing(p1, vx, diam1, diam1 - 2 * size, n);
		makeFlatRing(p4, vx, diam1, diam1 - 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copylength1 = length1;  copylength2 = length2;  copye = e;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		setMeshColor(3);
		diam1 -= 2 * size;

		FdPoint3d p1, p2, p3, p4;
		p1.set(-length1 / 2.0,           0, 0);
		p2.set(-length1 / 2.0 + length2, 0, 0);
		p3.set( length1 / 2.0 - length2, e, 0);
		p4.set( length1 / 2.0,           e, 0);
		FdPoint3d p[4] = { p1, p2, p3, p4 };

		makeElbowedTube(p, diam1, n, 3, true);
		makeFlatRing(p1, vx, diam1, diam1 + 2 * size, n);
		makeFlatRing(p4, vx, diam1, diam1 + 2 * size, n);
	}
}

void GLECircular::makeSTE(double diam1, double diam2, double length1, int n)
{
	/**********************************GEOMETRY*************************************/

	postTransformMesh(M_PI / 2, vx);

	FdPoint3d p1, p2;
	p1.set(-diam2, -diam1 / 2, 0);
	double mainTubeData[3] = { diam1, diam1, diam2 * 2 };
	double interPos[2] = { diam2, 0 };
	double interData[3] = { diam1 / 2 + length1, diam2, diam2 };
	double angles[3] = { 90, 90, 270 };
	int complex[2] = { n, n };
	bool bools[2] = { false, true };  // omit the main tube
	makeTubeToTubeIntersection(p1, vx, mainTubeData, interPos, interData, angles, complex, bools);

	setHlrSplineType(hlrConnector);
	p1.set(0,  length1, 0);
	p2.set(0, -(length1 + diam1) / 2, 0);
	addCenterLine(p1, p2);
	addCircularConnector(p1);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copydiam2 = diam2, copylength1 = length1;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		diam1 += size;
		diam2 += size;

		FdPoint3d p1, p2;
		p1.set(-(diam2 - size), -(diam1 - size) / 2, 0);
		double mainTubeData[3] = { diam1, diam1, (diam2 - size) * 2 };
		double interPos[2] = { diam2 - size, 0 };
		double interData[3] = { (diam1 - size) / 2 + length1, diam2, diam2 };
		double angles[3] = { 90, 90, 270 };
		int complex[2] = { n, n };
		bool bools[2] = { false, true };  // omit the main tube
		makeTubeToTubeIntersection(p1, vx, mainTubeData, interPos, interData, angles, complex, bools);

		makeFlatRing(p1, vx, diam1, diam1 - size, n);
		p1.set(diam2 - size, -(diam1 - size) / 2, 0);
		makeFlatRing(p1, vx, diam1, diam1 - size, n);
		p1.set(0, length1, 0);
		makeFlatRing(p1, vy, diam2, diam2 - size, n);
	}
	
	/**********************************Recover variables*******************************/
	diam1 = copydiam1;  diam2 = copydiam2;  length1 = copylength1;
	
	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		diam1 -= size;
		diam2 -= size;

		FdPoint3d p1, p2;
		p1.set(-(diam2 + size), -(diam1 + size) / 2, 0);
		double mainTubeData[3] = { diam1, diam1, (diam2 + size) * 2 };
		double interPos[2] = { diam2 + size, 0 };
		double interData[3] = { (diam1 + size) / 2 + length1, diam2, diam2 };
		double angles[3] = { 90, 90, 270 };
		int complex[2] = { n, n };
		bool bools[2] = { false, true };  // omit the main tube
		makeTubeToTubeIntersection(p1, vx, mainTubeData, interPos, interData, angles, complex, bools);

		makeFlatRing(p1, vx, diam1, diam1 + size, n);
		p1.set(diam2 + size, -(diam1 + size) / 2, 0);
		makeFlatRing(p1, vx, diam1, diam1 + size, n);
		p1.set(0, length1, 0);
		makeFlatRing(p1, vy, diam2, diam2 + size, n);
	}
}

void GLECircular::makeTC1(double diam1, double length1, double height, double width, double e, int n, double flange_1)
{
	/**********************************GEOMETRY*************************************/
	
	double fo = 30;  // flange offset
	FdPoint3d p1, p2, p3, p4;
	p1.set(-length1 / 2, 0, 0);
	double tubeParams[3] = { diam1, diam1, length1 };
	double positions[2] = { length1 / 2, 0 };
	double holeParams[3] = { width, height, diam1 / 2 + e - fo };
	bool bools[2] = { false, false };
	makeRectToTubeIntersection(p1, vx, -vz, tubeParams, positions, holeParams, n);

	p1.set(0, diam1 / 2 + e - fo, 0);
	p2.set(0, diam1 / 2 + e,      0);
	FdPoint3d p[2] = { p1, p2 };
	double tabWidth[2] = { height, height };
	double tabHeight[2] = { width, width };
	bool sides[4] = { true, true, true, true };
	bool con[2] = { false, false };  // true means draw, false means not to. {first connector, second connector}
	makeBox(1, p, tabWidth, tabHeight, sides, con, false, false);

	p1.set(-length1 / 2, 0, 0);
	addCircularConnector(p1);
	p1.set( length1 / 2, 0, 0);
	addCircularConnector(p1);

	p1.set(0, diam1 / 2 + e, 0);
	addRectangularConnector(p1, vy, vz, height + 2 * flange_1, width + 2 * flange_1);
	makeRectangularFlange(p1, vy, vz, height, width, flange_1);

	p1.set(0, diam1 / 2 + e - fo, 0);
	addSymbolicFlangeRect(p1, vy, vz, height, width);
	drawRectAsThinLines(p1, vy, vz, height, width);

	//---add axis center lines
	p1.set(-length1 / 2, 0, 0);
	p2.set( length1 / 2, 0, 0);
	addCenterLine(p1, p2);

	p1.set(0, 0, 0);
	p2.set(0, diam1 / 2 + e, 0);
	addCenterLine(p1, p2);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copylength1 = length1, copyheight = height, copywidth = width, copye = e;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		setMeshColor(1);

		diam1   += 2 * size;
		height  += 2 * size;
		width   += 2 * size;
		length1 += size;

		double fo = 30;  // flange offset
		FdPoint3d p1, p2, p3,p4;
		p1.set(-(length1 - size) / 2, 0, 0);
		double tubeParams[3] = { diam1, diam1, length1 - size };
		double positions[2] = { (length1 - size) / 2, 0 };
		double holeParams[3] = { width, height, (diam1 - 2 * size) / 2 + e };
		bool bools[2] = { false, false };
		makeRectToTubeIntersection(p1, vx, -vz, tubeParams, positions, holeParams, n);

		if( flange_1 < size )
			{
			p1.set(0, (diam1 - 2 * size) / 2 + e, 0);
			FdPoint3d cp[2] = { p1, p1 };
			FdVector3d v[2] = { vy, vy };
			FdVector3d upv[2] = { vx, vx };
			double tabWidth[2] = { height - 2 * size + 2 * flange_1, height };
			double tabHeight[2] = { width - 2 * size + 2 * flange_1, width };
			bool sides[4] = { true, true, true, true };
			makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, false, 5, 5, flange_1 - size);
			};

		p1.set(-(length1 - size) / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 - 2 * size, n);
		p1.set( (length1 - size) / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 - 2 * size, n);
	}


	/**********************************Recover variables*******************************/
	diam1 = copydiam1;  length1 = copylength1;  height = copyheight;  width = copywidth;  e = copye;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		setMeshColor(3);

		diam1   -= 2 * size;
		height  -= 2 * size;
		width   -= 2 * size;
		length1 -= size;

		double fo = 30;  // flange offset
		FdPoint3d p1, p2, p3, p4;
		p1.set(-(length1 + size) / 2, 0, 0);
		double tubeParams[3] = { diam1, diam1, length1 + size };
		double positions[2] = { (length1 + size) / 2, 0 };
		double holeParams[3] = { width, height, (diam1 + 2 * size) / 2 + e };
		bool bools[2] = { false, false };
		makeRectToTubeIntersection(p1, vx, -vz, tubeParams, positions, holeParams, n);

		p1.set(0, (diam1 + 2 * size) / 2 + e, 0);
		FdPoint3d cp[2] = { p1, p1 };
		FdVector3d v[2] = { vy, vy };
		FdVector3d upv[2] = { vx, vx };
		double tabWidth[2] = { height, height + 2 * size };
		double tabHeight[2] = { width, width + 2 * size };
		bool sides[4] = { true, true, true, true };
		makeBox(1, cp, v, upv, tabWidth, tabHeight, sides, false, false, 5, 5, 0);

		p1.set(-(length1 + size) / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 + 2 * size, n);
		p1.set( (length1 + size) / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 + 2 * size, n);
	}	
}

void GLECircular::makeTC2(double diam1, double diam2, double diam3, double length1, double length2, int n)
{
	/**********************************GEOMETRY*************************************/
	
	FdPoint3d p1, p2;
	p1.set(-length1/2, 0, 0);
	double tubeData[2] = {diam1, length1};
	double interTubeData[4] = {diam3, length2, length1/2, 0};
	double angles[2] = {0, 270};
	double sideLen = (length1 - diam3)/2;

	if(diam1>=diam2 && diam1>=diam3){

		if(diam1==diam2)
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		else{
			tubeData[1] = length1 - sideLen;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

			p1.set(-length1/2 + sideLen + diam3, 0, 0);
			p2.set(length1/2, 0, 0);
			makeSimpleTube(p1, p2, diam1, diam2, n);
		}
	}
	if(diam2>diam1 && diam2>=diam3){
		//acutPrintf("here\n");
		tubeData[0] = diam2;
		tubeData[1] = length1 - sideLen;
		p1.set(-length1/2 + sideLen, 0, 0);
		interTubeData[2] = diam3/2;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);
		
		p1.set(-length1/2, 0, 0);
		p2.set(-length1/2 + sideLen, 0, 0);
		makeSimpleTube(p1, p2, diam1, diam2, n);
	}
	if(diam3>diam1 && diam3>diam2){
		p1.set(-length1/2 + sideLen, 0, 0);
		tubeData[0] = diam3;
		tubeData[1] = diam3;
		interTubeData[2] = diam3/2;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		p1.set(-length1/2, 0, 0);
		p2.set(-length1/2 + sideLen, 0, 0);
		makeSimpleTube(p1, p2, diam1, diam3, n);

		p1.set(length1/2, 0, 0);
		p2.set(length1/2 - sideLen, 0, 0);
		makeSimpleTube(p1, p2, diam2, diam3, n);
	}
	p1.set(0, 0, 0);
	drawAsThinArc(p1);
	p1.set(-length1/2, 0, 0);
	addCircularConnector(p1);
	p1.set(length1/2, 0, 0);
	addCircularConnector(p1);
	p1.set(0, length2, 0);
	addCircularConnector(p1);
	p1.set(-length1/2, 0, 0);
	p2.set(length1/2, 0, 0);
	addCenterLine(p1, p2);
	p1.set(0, 0, 0);
	p2.set(0, length2, 0);
	addCenterLine(p1, p2);
	setHlrSplineType(hlrThin);


	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copydiam2 = diam2, copydiam3 = diam3, copylength1 = length1, copylength2 = length2;
	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		setMeshColor(1);

		diam1 += 2 * size;
		diam2 += 2 * size;
		diam3 += 2 * size;

		FdPoint3d p1, p2;
		p1.set(-length1 / 2, 0, 0);
		double tubeData[2] = { diam1, length1 };
		double interTubeData[4] = { diam3, length2, length1 / 2, 0 };
		double angles[2] = { 0, 270 };
		double sideLen = (length1 - diam3) / 2;

		if( diam1 >= diam2 && diam1 >= diam3 ) {
			if( diam1 == diam2 )
				makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);
			else {
				tubeData[1] = length1 - sideLen;
				makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

				p1.set(-length1 / 2 + sideLen + diam3, 0, 0);
				p2.set( length1 / 2, 0, 0);
				makeSimpleTube(p1, p2, diam1, diam2, n);
			}
		}
		if( diam2 > diam1 && diam2 >= diam3 ) {
			tubeData[0] = diam2;
			tubeData[1] = length1 - sideLen;
			p1.set(-length1 / 2 + sideLen, 0, 0);
			interTubeData[2] = diam3 / 2;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

			p1.set(-length1 / 2, 0, 0);
			p2.set(-length1 / 2 + sideLen, 0, 0);
			makeSimpleTube(p1, p2, diam1, diam2, n);
		}
		if( diam3 > diam1 && diam3 > diam2 ) {
			p1.set(-length1 / 2 + sideLen, 0, 0);
			tubeData[0] = diam3;
			tubeData[1] = diam3;
			interTubeData[2] = diam3 / 2;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

			p1.set(-length1 / 2, 0, 0);
			p2.set(-length1 / 2 + sideLen, 0, 0);
			makeSimpleTube(p1, p2, diam1, diam3, n);

			p1.set( length1 / 2, 0, 0);
			p2.set( length1 / 2 - sideLen, 0, 0);
			makeSimpleTube(p1, p2, diam2, diam3, n);
		}

		p1.set(-length1 / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 - 2 * size, n);
		p1.set(0, length2, 0);
		makeFlatRing(p1, vy, diam2, diam2 - 2 * size, n);
		p1.set( length1 / 2, 0, 0);
		makeFlatRing(p1, vx, diam2, diam3 - 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copydiam2 = diam2;  copydiam3 = diam3;  copylength1 = length1;  copylength2 = length2;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		setMeshColor(3);

		diam1 -= 2 * size;
		diam2 -= 2 * size;
		diam3 -= 2 * size;

		FdPoint3d p1, p2;
		p1.set(-length1 / 2, 0, 0);
		double tubeData[2] = { diam1, length1 };
		double interTubeData[4] = { diam3, length2, length1 / 2, 0 };
		double angles[2] = { 0, 270 };
		double sideLen = (length1 - diam3) / 2;

		if( diam1 >= diam2 && diam1 >= diam3 ) {
			if( diam1 == diam2 )
				makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);
			else {
				tubeData[1] = length1 - sideLen;
				makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

				p1.set(-length1 / 2 + sideLen + diam3, 0, 0);
				p2.set( length1 / 2, 0, 0);
				makeSimpleTube(p1, p2, diam1, diam2, n);
			}
		}
		if( diam2 > diam1 && diam2 >= diam3 ) {
			tubeData[0] = diam2;
			tubeData[1] = length1 - sideLen;
			p1.set(-length1 / 2 + sideLen, 0, 0);
			interTubeData[2] = diam3 / 2;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

			p1.set(-length1 / 2, 0, 0);
			p2.set(-length1 / 2 + sideLen, 0, 0);
			makeSimpleTube(p1, p2, diam1, diam2, n);
		}
		if( diam3 > diam1 && diam3 > diam2 ) {
			p1.set(-length1 / 2 + sideLen, 0, 0);
			tubeData[0] = diam3;
			tubeData[1] = diam3;
			interTubeData[2] = diam3 / 2;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

			p1.set(-length1 / 2, 0, 0);
			p2.set(-length1 / 2 + sideLen, 0, 0);
			makeSimpleTube(p1, p2, diam1, diam3, n);

			p1.set( length1 / 2, 0, 0);
			p2.set( length1 / 2 - sideLen, 0, 0);
			makeSimpleTube(p1, p2, diam2, diam3, n);
		}

		p1.set(-length1 / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 + 2 * size, n);
		p1.set(0, length2, 0);
		makeFlatRing(p1, vy, diam2, diam2 + 2 * size, n);
		p1.set( length1 / 2, 0, 0);
		makeFlatRing(p1, vx, diam2, diam3 + 2 * size, n);
	}
}

void GLECircular::makeTC3(double diam1, double diam2, double length1, double length2, double length3, int n)
{
	/**********************************GEOMETRY*************************************/
	
	postTransformMesh(M_PI, vy);

	// if the intersecting tube's diameter<=main's, then the connectors needn't be drawn seperately...
	// in other words, they can just be included as part of the main tube...but if the intersecting tube's 
	// diameter > main's, then the two connectors must be drawn seperately
	FdPoint3d p1, p2;
	p1.set(-(length1 + length3 * 2) / 2, 0, 0);
	double tubeData[2] = { diam1, length1 + length3 * 2 };
	double interTubeData[4] = { diam2, length2, tubeData[1] / 2, (diam1 - diam2) / 2 };
	double angles[2] = { 0, 270 };
	if( diam2 <= diam1 ) {
		// define the directional vector for both tee intersection functions
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);
	} else {
		p1.set(-length1 / 2 + (length1 - diam2) / 2, 0, (diam2 - diam1) / 2);
		tubeData[0] = diam2;  tubeData[1] = diam2;
		interTubeData[2] = diam2 / 2;  interTubeData[3] = 0;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		p1.set(-length1 / 2, 0, 0);
		p2.set(-length1 / 2 + (length1 - diam2) / 2, 0, (diam2 - diam1) / 2);
		FdPoint3d p[2] = { p1, p2 };
		double diams[2] = { diam1, diam2 };
		makeUniVectorTube(p, vx, diams, n, 1, true);

		p1.set( length1 / 2, 0, 0);
		p2.set(-length1 / 2 + (length1 - diam2) / 2 + diam2, 0, (diam2 - diam1) / 2);
		p[0] = p1;
		p[1] = p2;
		makeUniVectorTube(p, -vx, diams, n, 1, true);
	}

	//--- if intersecting diam >= main, we actually get ellipses at the saddle of the intersection,
	//--- not splines, so we must remember to specify that these should be thin
	if( diam2 >= diam1 )
	{
		p1.set(0, 0, (diam2 - diam1) / 2);
		drawAsThinArc(p1);
	}

	//--- add HLR info
	setHlrSplineType(hlrThin);
	p1.set(-length1 / 2, 0, 0);
	p2.set( length1 / 2, 0, 0);	
	addCenterLine(p1, p2);
	p1.set(0, 0, -(diam1 - diam2) / 2);
	p2.set(0, length2, -(diam1 - diam2) / 2);
	addCenterLine(p1, p2);
	p1.set(-length1 / 2, 0, 0);
	addCircularConnector(p1);
	p1.set( length1 / 2, 0, 0);
	addCircularConnector(p1);
	p1.set(0, length2, -(diam1 - diam2) / 2);
	addCircularConnector(p1);
	
	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copydiam2 = diam2, copylength1 = length1, copylength2 = length2, copylength3 = length3;
	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		setMeshColor(1);

		diam1 += 2 * size;
		diam2 += 2 * size;

		// if the intersecting tube's diameter<=main's, then the connectors needn't be drawn seperately...
		// in other words, they can just be included as part of the main tube...but if the intersecting tube's 
		// diameter>main's, then the two connectors must be drawn seperately

		FdPoint3d p1, p2;
		p1.set(-(length1 + length3 * 2) / 2, 0, 0);
		double tubeData[2] = { diam1, length1 + length3 * 2 };
		double interTubeData[4] = { diam2, length2, tubeData[1] / 2, diam1 / 2 - diam2 / 2 };
		double angles[2] = { 0, 270 };

		if( diam2 <= diam1 ) {
			// define the directional vector for both tee intersection functions
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);
		} else {
			p1.set(-length1 / 2 + (length1 - diam2) / 2, 0, (diam2 - diam1) / 2);
			tubeData[0] = diam2;  tubeData[1] = diam2;
			interTubeData[2] = diam2 / 2;  interTubeData[3] = 0;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

			p1.set(-length1 / 2, 0, 0);
			p2.set(-length1 / 2 + (length1 - diam2) / 2, 0, (diam2 - diam1) / 2);
			FdPoint3d p[2] = { p1, p2 };
			double diams[2] = { diam1, diam2 };
			makeUniVectorTube(p, vx, diams, n, 1, true);

			p1.set( length1 / 2, 0, 0);
			p2.set(-length1 / 2 + (length1 - diam2) / 2 + diam2, 0, (diam2 - diam1) / 2);
			p[0] = p1;
			p[1] = p2;
			makeUniVectorTube(p, -vx, diams, n, 1, true);
		}

		p1.set(0, (length1 + length3 * 2) / 2 + size / 2, -size / 2);
		makeFlatRing(p1, vy, diam2, diam2 - 2 * size, n);
		p1.set( length1 / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 - 2 * size, n);
		p1.set(-length1 / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 - 2 * size, n);
	}

	if( getIntInsSize(size) )
	{
		setPrimitiveMode(FLM3Geo::pmIntInsulation);

		diam1 -= 2 * size;
		diam2 -= 2 * size;

		// if the intersecting tube's diameter<=main's, then the connectors needn't be drawn seperately...
		// in other words, they can just be included as part of the main tube...but if the intersecting tube's 
		// diameter>main's, then the two connectors must be drawn seperately

		FdPoint3d p1, p2;
		p1.set(-(length1 + length3 * 2) / 2, 0, 0);
		double tubeData[2] = { diam1, length1 + length3 * 2 };
		double interTubeData[4] = { diam2, length2, tubeData[1] / 2, diam1 / 2 - diam2 / 2 };
		double angles[2] = { 0, 270 };

		if( diam2 <= diam1 ) {
			// define the directional vector for both tee intersection functions
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);
		} else {
			p1.set(-length1 / 2 + (length1 - diam2) / 2, 0, (diam2 - diam1) / 2);
			tubeData[0] = diam2;  tubeData[1] = diam2;
			interTubeData[2] = diam2 / 2;  interTubeData[3] = 0;
			makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

			p1.set(-length1 / 2, 0, 0);
			p2.set(-length1 / 2 + (length1 - diam2) / 2, 0, (diam2 - diam1) / 2);
			FdPoint3d p[2] = { p1, p2 };
			double diams[2] = { diam1, diam2 };
			makeUniVectorTube(p, vx, diams, n, 1, true);

			p1.set( length1 / 2, 0, 0);
			p2.set(-length1 / 2 + (length1 - diam2) / 2 + diam2, 0, (diam2 - diam1) / 2);
			p[0] = p1;
			p[1] = p2;
			makeUniVectorTube(p, -vx, diams, n, 1, true);
		}

		p1.set(0, (length1 + length3 * 2) / 2 + size / 2, -size / 2);
		makeFlatRing(p1, vy, diam2, diam2 + 2 * size, n);
		p1.set( length1 / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 + 2 * size, n);
		p1.set(-length1 / 2, 0, 0);
		makeFlatRing(p1, vx, diam1, diam1 + 2 * size, n);
	}
}

void GLECircular::makeTUBE(double diam1, double length1, int n)
{
	//--- Make the simple tube.
	FdPoint3d left(-length1/2, 0, 0), right(length1/2, 0, 0);
	makeVerySimpleTube(left, right, diam1, n);

	//--- Make internal Insulation.
	double intInsOffset;
	if( getIntInsSize(intInsOffset) )
		{
	#ifndef __TODO__
		setMeshColor(3);
	#endif
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		makeVerySimpleTube(left, right, diam1 - intInsOffset * 2, n);
		makeFlatRing(left, xVec, diam1 - intInsOffset * 2, diam1, n);
		makeFlatRing(right, xVec, diam1 - intInsOffset * 2, diam1, n);
		}

	//--- Make external insulation.
	double extInsOffset;
	if( getExtInsSize(extInsOffset) )
		{
	#ifndef __TODO__
		setMeshColor(1);
	#endif
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		makeVerySimpleTube(left, right, diam1 + extInsOffset * 2, n);
		makeFlatRing(left, xVec, diam1 + extInsOffset * 2, diam1, n);
		makeFlatRing(right, xVec, diam1 + extInsOffset * 2, diam1, n);
		};

	//--- Add Hlr Info.
	addCircularConnector(left);
	addCircularConnector(right);
	addCenterLine(left, right);
}

void GLECircular::makeUAE(double diam1, double diam2, double length1, int n)
{
	/**********************************GEOMETRY*************************************/

	//--- Make the tube.
	FdPoint3d left(-length1 / 2, 0, 0), right(length1 / 2, -(diam1 - diam2) / 2, 0);
	FdPoint3d centers[2] = { left, right };
	double diams[2] = { diam1, diam2 };
	makeUniVectorTube(centers, xVec, diams, n, 1, true);

	//--- Add Hlr Info.
	addCircularConnector(left);
	addCircularConnector(right);
	addCenterPolyLine(centers, 1);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copydiam2 = diam2, copylength1 = length1;

	/**********************************Ext Insulation*******************************/

	double size;
	if( getExtInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		diam1 += 2 * size;
		diam2 += 2 * size;
		FdPoint3d left(-length1 / 2, 0, 0), right(length1 / 2, -(diam1 - diam2) / 2, 0);
		FdPoint3d centers[2] = { left, right };
		double diams[2] = { diam1, diam2 };
		makeUniVectorTube(centers, xVec, diams, n, 1, true);

		makeFlatRing(left, vx, diam1, diam1 - 2 * size, n);
		makeFlatRing(right, vx, diam2, diam2 - 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copydiam2 = diam2;  copylength1 = length1;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setMeshColor(3);
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		diam1 -= 2 * size;
		diam2 -= 2 * size;
		FdPoint3d left(-length1 / 2, 0, 0), right(length1 / 2, -(diam1 - diam2) / 2, 0);
		FdPoint3d centers[2] = { left, right };
		double diams[2] = { diam1, diam2 };
		makeUniVectorTube(centers, xVec, diams, n, 1, true);

		makeFlatRing(left, vx, diam1, diam1 + 2 * size, n);
		makeFlatRing(right, vx, diam2, diam2 + 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copydiam2 = diam2;  copylength1 = length1;
}

void GLECircular::makeUSE(double diam1, double diam2, double length1, int n)
{
	/**********************************GEOMETRY*************************************/

	//--- Make the tube.
	FdPoint3d left(-length1 / 2, 0, 0), right(length1 / 2, 0, 0);
	FdPoint3d centers[2] = { left, right };
	makeSimpleTube(centers, diam1, diam2, n);

	//--- Add Hlr Info.
	addCircularConnector(left);
	addCircularConnector(right);
	addCenterLine(left, right);

	/****************************Copy/create Insulation vairables*******************/
	double copydiam1 = diam1, copydiam2 = diam2, copylength1 = length1;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		diam1 += 2 * size;
		diam2 += 2 * size;
		//--- Make the tube
		FdPoint3d left(-length1 / 2, 0, 0), right(length1 / 2, 0, 0);
		FdPoint3d centers[2] = { left, right };
		makeSimpleTube(centers, diam1, diam2, n);
		makeFlatRing(left, vx, diam1, diam1 - 2 * size, n);
		makeFlatRing(right, vx, diam2, diam2 - 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copydiam2 = diam2;  copylength1 = length1;

	/**********************************Int Insulation*******************************/
	if( getIntInsSize(size) )
	{
		setMeshColor(3);
		setPrimitiveMode(FLM3Geo::pmIntInsulation);
		diam1 -= 2 * size;
		diam2 -= 2 * size;
		//--- Make the tube
		FdPoint3d left(-length1 / 2, 0, 0), right(length1 / 2, 0, 0);
		FdPoint3d centers[2] = { left, right };
		makeSimpleTube(centers, diam1, diam2, n);
		makeFlatRing(left, vx, diam1, diam1 + 2 * size, n);
		makeFlatRing(right, vx, diam2, diam2 + 2 * size, n);
	}

	/**********************************Recover variables*******************************/
	copydiam1 = diam1;  copydiam2 = diam2;  copylength1 = length1;
}

void GLECircular::makeASV(double d1, double l1, double l2, int n)
{
	n = 10;
	int Segs = 1;

	FdPoint3d p1(-l1 / 2.0, 0, 0), p2(l1 / 2.0, 0, 0);

	double rang2 = M_PI * (180 - 45) / 180.0;
	double x1 = p1.x + sin(rang2);
	double y1 = p2.y + cos(rang2);
	double x2 = x1 + sin(rang2) * l2;
	double y2 = y1 - cos(rang2) * l2;
	// double rang2 = M_PI * (180 - 45) / 180.0;
	// p3.rotateBy(45, vy);

	FdPoint3d cp[2] = { p1, p2 };
	FdVector3d v[2] = { vx, vx };

	double diam[2][2] = { d1, d1, d1, d1 };

	makeTube(cp, v, diam, n, Segs, 0, false);

	// FdPoint3d p1, p2, p3;
	// p1.set( -l1 / 2.0, 0, 0 );
	// p2.set( -l1 / 2.0 + l2, 0, 0 );
	// p3.set( -l1 / 2.0 + l2, -1, 145 );

	// FdPoint3d p[3] = { p1, p2, p3 };
	// makeElbowedTube(p, d1, n, 2, true);

	// double cp[3][3];
	// double v[3][3];
	// double Upv[3][3];
	// double diams[3][2];
	// int n1 = 10;
	// int Segs = 2;

	// cp[0][0] = 200;  cp[0][1] = 200;  cp[0][2] = 0;
	// v[0][0] = 1;  v[0][1] = 1;  v[0][2] = 0;
	// Upv[0][0] = -1;  Upv[0][1] = 1;  Upv[0][2] = 0;
	// diams[1][0] = 100;  diams[0][1] = 60;

	// cp[1][0] = 300;  cp[1][1] = 300;  cp[1][2] = 0;
	// v[1][0] = 1;  v[1][1] = 0;  v[1][2] = 0;
	// Upv[1][0] = 0;  Upv[1][1] = 1;  Upv[1][2] = 0;
	// diams[1][0] = 200;  diams[1][1] = 100;

	// cp[2][0] = 400;  cp[2][1] = 200;  cp[2][2] = 0;
	// v[2][0] = 1;  v[2][1] = -1;  v[2][2] = 0;
	// Upv[2][0] = 1;  Upv[2][1] = 1;  Upv[2][2] = 0;
	// diams[2][0] = 100;  diams[2][1] = 60;

	// makeTube(cp, v, Upv, diams, n1, Segs, 0, false);

	// FdPoint3d center[2] = { p1, p2 };
	// p2.rotateBy(45 * ARX_PI / 180, vz);
	// makeVerySimpleTube(p1, p2, d1, n);
}

void GLECircular::makeCOLL(double d, double d1, double h, double h1, int n)
{
	n = 10;

	FdPoint3d p1(0, 0, 0), p2(-h1 / 2, 0, 0);
	double tubeData[2] = { d, h1 };
	double interTubeData[4] = { d1, d / 2 + 50, h, 0 };
	double angles[2] = { 0, 0 };

	// FdPoint3d cp[2] = { p1, p2 };
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

	angles[1] = 90;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

	angles[1] = 180;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

	angles[1] = 270;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

	/****************************Copy/create Insulation vairables*******************/
	double copyd = d, copyd1 = d1, copyh = h, copyh1 = h1;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		d += 2 * size;
		d1 += 2 * size;
		FdPoint3d p1(0, 0, 0), p2(-h1 / 2, 0, 0);
		FdPoint3d p3(h, d / 2 + 50, 0), p4(h, -d / 2 - 50, 0), p5(h, 0, d / 2 + 50), p6(h, 0, -d / 2 - 50);

		double tubeData[2] = { d, h1 };
		double interTubeData[4] = { d1, d / 2 + 50, h, 0 };
		double angles[2] = { 0, 0 };

		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		angles[1] = 90;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		angles[1] = 180;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		angles[1] = 270;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		p2.set(h1, 0, 0);
		makeFlatRing(p1, vx, d, d - 2* size, n);
		makeFlatRing(p2, vx, d, d - 2* size, n);
		makeFlatRing(p3, vy, d1, d1 - 2* size, n);
		makeFlatRing(p4, vy, d1, d1 - 2* size, n);
		makeFlatRing(p5, vz, d1, d1 - 2* size, n);
		makeFlatRing(p6, vz, d1, d1 - 2* size, n);
	}
}

void GLECircular::makeXSVL(double l1, double l2, double d1, double d3, double angle, int n)
{
	n = 10;

	FdPoint3d p1(0, 0, 0);
	// double alpha = M_PI / 2 - angle * (M_PI / 180);
	double tubeData[2] = { d1, l1 };
	double interTubeData[4] = { d3, l2, l1 / 2 - d1 / 2, 0 };
	double angles[2] = { 45, 90 };

	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

	angles[1] = 270;
	makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

	/****************************Copy/create Insulation vairables*******************/
	double copyd1 = d1, copyd3 = d3, copyl1 = l1, copyl2 = l2;

	/**********************************Ext Insulation*******************************/
	double size;
	if( getExtInsSize(size) )
	{
		setMeshColor(1);
		setPrimitiveMode(FLM3Geo::pmExtInsulation);
		d1 += 2 * size;
		d3 += 2 * size;
		FdPoint3d p1(0, 0, 0), p2(l1, 0, 0), p3(l2, l1 / 2 - d1 / 2, 0);
		double tubeData[2] = { d1, l1 };
		double interTubeData[4] = { d3, l2, l1 / 2 - d1 / 2, 0 };
		double angles[2] = { 45, 90 };
	
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		angles[1] = 270;
		makeTubeToTubeIntersection2(p1, vx, tubeData, interTubeData, angles, n, false);

		makeFlatRing(p1, vx, d1, d1 - 2 * size, n);
		makeFlatRing(p2, vx, d1, d1 - 2 * size, n);
	}
}

void GLECircular::makeBPBKC(double d1, double d3, double alfa, double r, double l, int n)
{
	n = 10;
	double angle = 90;
	double seg = 10;

	// double radius = d1 * r;
	// double rang = M_PI * angle / 180.0;
	// double x = radius - (radius - d1 / 2.0) * (1 - cos(rang)) / 2.0;
	// double y = (radius + d1 / 2.0) * sin(rang) / 2.0;
	// FdPoint3d p1(x, -y, 0), p2;
	// makeDonutSection(p1, -vz, -vx, radius, d1, angle, n, seg);

	// double mainTubeData[3] = { d3, d3, d1 };
	// double interPos[2] = { d3/2, 0 };
	// double interData[3] = { l, d3, d3 };
	// double angles[3] = { 45, 90, 270 };
	// int complex[2] = { n, n };
	// bool bools[2] = { false, true };  // omit the main tube
	// p1.set(-x/2, y/2, 0);
	// makeTubeToTubeIntersection(p1, vx, mainTubeData, interPos, interData, angles, complex, bools);

	// FdPoint3d pp1(0, l, 0), pp2(0, -l, 0);

	// double seg2 = 1;
	// FdPoint3d Cp[3] = { pp1, pp2 };
	// FdVector3d pp(sqrt(0.5), sqrt(0.5), 0), ppp(sqrt(0.5), sqrt(0.5), 0);
	// FdVector3d Vec[2] = { pp, ppp };
	// double dim[2][2] = { d3, d3, d3, d3 };
	// makeTube(Cp, Vec, dim, n, seg2, 0, false);

	FdPoint3d DonutCenter_(0, 0, 0);
	FdVector3d DonutAxis_(0, 0, 1);
	double radius = 1 * d1;
	double dim = d1;
	double sweepAngle = 90;
	makeDonutSection(DonutCenter_, DonutAxis_, -vx, radius, dim, sweepAngle, n, seg);

	FdPoint3d p1(-d1, -d1, 0);
	FdVector3d z = vz;
	FdVector3d y = vy;
	FdVector3d x = vx;
	double rang = M_PI * 45 / 180;
	x.rotateBy(rang, z);
	FdPoint3d p1Bis(p1 - l/2 * x);
	FdPoint3d p2Bis(p1 + l/2 * x);
	FdPoint3d NewPoint[2] = { p1Bis, p2Bis };
	FdVector3d Vec[2] = { x, x };
	double dim2[2][2] = { d3, d3, d3, d3 };
	
	makeTube(NewPoint, Vec, dim2, n, 1, 0, false);
}

void GLECircular::makeILSV45(double d1, double d2, double alfa, double lm, double l, double l2, int n)
{
	FdVector3d z = vz;
	FdVector3d y = vy;
	FdVector3d y2 = vy;
	FdVector3d x = vx;

	n = 10;
	alfa = 45;
	l2 = d1 + l;
	lm = l2 - ( d1 / 2 ); 
	
	d2 = (sqrt(( d1 / 2 * d1 / 2 ) + ( d1 / 2 * d1 / 2 )))*2;
	// d2 = (sqrt((d1 * d1 ) + ((l2 - l ) * ( l2 - l ))));
	// double xx = l*1.4142/2 + d2/2;
	double xx = sqrt(( lm / 2 * lm / 2 ) + ( lm / 2 * lm / 2 ));
	double rangl = M_PI * alfa / 180;
	
	// FdPoint3d p1(xx, 0, 0), p2(0, lm, 0);
	// FdPoint3d p1(xx, -lm/2, 0), p2(0, lm/2, 0);
	FdPoint3d p1(xx, 0, 0), p2(0, xx, 0);
	y2.rotateBy(rangl, z);
	FdPoint3d Cp[2] = { p1, p2 };
	FdVector3d V[2] = { y, y2 };
	double dim[2][2] = { d2, d2, d1, d1 };

	makeTube(Cp, V, dim, n, 1, 0, false);
}

void GLECircular::makeTRI45_90(double diam1, double diam2, double diam3, double alfa, double l1, double l2, double l3)
{
	double n = 10;

	FdPoint3d cp1(0,   0,         0),
	          cp2(l1,  0,         0),
	          cp3(l1, -diam1 / 2, 0),
	          cp4(l1,  diam1 / 2, 0);
	FdPoint3d cpTube[2] = { cp1, cp2 };
	makeSimpleTube(cpTube, diam1, diam1, n);

	double radius = diam2 / 2;
	double radius_2 = diam3 / 2;
	double sweepAngle = 90;
	double sweepAngle_2 = 45;
	double seg = 10;

	makeDonutSection(cp3, -vz,  vy, radius, diam2, sweepAngle, n, seg);
	makeDonutSection(cp4,  vz, -vy, radius_2, diam3, sweepAngle_2, n, seg);
	makeFlatDisc(cp2, vx, diam1, n);
}

////////////////////////////////////END OF MAKE GENERAL CIRCULAR ELEMENT FUNCTIONS//////////////////////////////////

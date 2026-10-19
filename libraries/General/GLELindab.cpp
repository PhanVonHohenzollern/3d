#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define LindabBlockCreator SmkGenBlockCreator

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

short LindabBlockCreator::makeLIN_CIRC(const FdPoint3d &base)
{
	ads_real a;
	get_val("a", a);
	
	FdPoint3d sV4(base.x + a/2-10*2, base.y + (a/2)-10*2, base.z - 38);   //bylo 	FdPoint3d sV4(base.x - 38, base.y + (a/2)-10*2, base.z + a/2-10*2);
	makeSymbolicCircle(sV4, vz, 10); //bylo vx

	return 0;
}
short LindabBlockCreator::makeLIN_BOX(const FdPoint3d &base)
{
	ads_real L, d, C_for_geo, h_box, W, d1, D, B;
	get_val("L", L);
	get_val("d", d);
	get_val("C_for_geo", C_for_geo);
	get_val("h_box", h_box);
	get_val("W", W);
	get_val("d1", d1);
	get_val("D", D);
	get_val("B", B);

	int count = 1;

	float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		FdPoint3d box1(base.x + 0, base.y + move_d, base.z + 72),								//bylo box1(72, move_d, 0),
				  box2(base.x + 0, base.y + move_d, base.z + h_box + 72);						//bylo box2(h_box + 72, move_d, 0);	
		FdPoint3d cpBox[2] = { box1, box2 };
		double Length[2] = { W, W }; //bylo L,L
		double Width[2] = { L, L };	//bylo W,W
		bool sides[4] = { true, false, true, true };
		bool connectors[2] = {false, false};

		makeBox(count, cpBox, Width, Length, sides, connectors, false, true);

		FdPoint3d RecStart(base.x + 0, base.y + L / 2 + move_d, base.z + 72 + h_box / 2);		//bylo FdPoint3d RecStart(72 + h_box / 2,  L / 2 + move_d, 0);
		FdPoint3d TubeStart(base.x + 0, base.y + L / 2 + move_d, base.z + 72 + h_box - B + 6);		//bylo FdPoint3d TubeStart(72 + h_box - B, L / 2 + move_d, 0);
		int n = 10;

		double mainTpar [3] = { d1, d1, D };
		double heightWidth [2] = { h_box, W };
	
		makeRectToTubeTransition(RecStart, vy, vz, heightWidth, TubeStart, mainTpar, n);	//bylo vy, vx 
		
		double mainTpar2 [3] = { d, d, 0 };
		double heightWidth2 [2] = { W, L }; //bylo L,W

		FdPoint3d boxFlat(base.x + 0, base.y + 0, base.z + 72);							//bylo FdPoint3d boxFlat(72, 0, 0);
		FdPoint3d CircleFlat(base.x + 0, base.y + move_d, base.z + 72);					//FdPoint3d CircleFlat(72, move_d, 0);
		
		makeRectToTubeTransition(CircleFlat, vz, vx, heightWidth2, boxFlat, mainTpar2, n);
	
		return 0;
}
short LindabBlockCreator::makeLIN_PKA()
{
	char *MBZ;
	char *plenum_box;
	ads_real a, u, d, h2, d1, L, H, D, h_box, h_box_MBZ, W, C_for_geo, B;
	get_val("a", a);
	get_val("u", u);
	get_val("d", d);
	get_val("h2", h2);
	get_val("MBZ", MBZ);
	get_val("plenum_box", plenum_box);
	get_val("d1", d1);
	get_val("L", L);
	get_val("H", H);
	get_val("D", D);
	get_val("h_box", h_box);
	get_val("h_box_MBZ", h_box_MBZ);
	get_val("W", W);
	get_val("C_for_geo", C_for_geo);
	get_val("B", B);
	
	int count = 1;

	FdPoint3d sV1(0, 0, 0), sV2(0, 0, 22), sV3(0, 0, -38);							//bylo  sV2(22, 0, 0), sV3(-38, 0, 0); 
	FdPoint3d Cp[2] = { sV1, sV2 };
	FdPoint3d Cp_2[2] = { sV1, sV3 };

	double heightWidth[2] = { u, u };
	double heightWidth_2[2] = { a, a };
	double tubePar[3] = { d, d, 50 };
	double tubePar_2[3] = { d, d, 0 };
	bool sides[4] = { true, true, true, true };
	bool connectors[2] = {false, false};
	int n = 10;

	makeRectToTubeTransition(sV2, vz, vx, heightWidth, sV2, tubePar, n);			//by³o odwrotnie vx, vz
	makeRectToTubeTransition(sV1, vz, vx, heightWidth_2, sV1, tubePar_2, n);
	makeBox(count, Cp, heightWidth, heightWidth, false);
	makeBox(count, Cp_2, heightWidth_2, heightWidth_2, sides, connectors, false, true);

	FdPoint3d base(0, 0, 0);
	FdPoint3d sV4(base.x + a/2-10*2, base.y + (a/2)-10*2, base.z - 38);			// bylo sV4(base.x - 38, base.y - (a/2)-10*2 , base.z + a/2-10*2);

	float gap_btw_circ = 15;
	float circ_num = floor( a / gap_btw_circ ) - 1;

	for(int i = 0; i < circ_num; i++)
	{
		for(int i = 0; i < circ_num; i++)
		{
			makeLIN_CIRC(base);
			base.x += 0;
			base.y -= gap_btw_circ; 
			base.z += 0;											// base.z -= gap_btw_circ;
		}
		base.set(base.x, 0, 0);								// bylo base.set(base.x, base.y, 0);
			makeLIN_CIRC(base);
			base.x -= gap_btw_circ;
			base.y += 0;											//bylo gap_btw_circ;
			base.z += 0;
	}
	if( ( plenum_box != NULL ) && ( MBZ == NULL ) )
	{
		FdPoint3d base(0, 0, 0);

		makeLIN_BOX(base);
	}
	if( ( MBZ != NULL ) && ( plenum_box != NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),							// bylo FdPoint3d SimT1(-h2/2, 0, 0),
				  SimT2(0, 0, h2/2);							// bylo SimT2(h2/2, 0, 0);	
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 72 + h2), SimT2.set(0, 0, 72) };			//bylo FdPoint3d cpSimT[2] = { SimT1.set(72 + h2, 0, 0), SimT2.set(72, 0, 0) };
		makeVerySimpleTube(cpSimT, d, n);

		float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		
		FdPoint3d base(0, 0, h2);
		FdPoint3d box_MBZ1(base.x, base.y, base.z + h2), box_MBZ2(base.x, base.y, base.z + h2);
		FdPoint3d RecStart(base.x, base.y, base.z + h2);			
		FdPoint3d TubeStart(base.x, base.y, base.z + h2 - B);
		FdPoint3d boxFlat(base.x, base.y, base.z + h2);				
		FdPoint3d CircleFlat(base.x, base.y, base.z + h2);

		makeLIN_BOX(base);
	}
	if( (MBZ != NULL ) && ( plenum_box == NULL ) )
	{
		FdPoint3d base(0, 0, 0);
		FdPoint3d SimT1(0, 0, -h2/2),						//bylo FdPoint3d SimT1(-h2/2, 0, 0),
				  SimT2(0, 0, h2/2);						//bylo SimT2(h2/2, 0, 0);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 72 + h2), SimT2.set(0, 0, 72) };		//bylo FdPoint3d cpSimT[2] = { SimT1.set(72 + h2, 0, 0), SimT2.set(72, 0, 0) };
		makeVerySimpleTube(cpSimT, d, n);
	}
	return 0;
}

short LindabBlockCreator::makeLIN_LKA()
{
	ads_real a, u, d, plenum_box, MBZ, h2, C_for_geo, B, L;
	get_val("a", a);
	get_val("u", u);
	get_val("d", d);
	get_val("plenum_box", plenum_box);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("C_for_geo", C_for_geo);
	get_val("B", B);
	get_val("L", L);

	int count = 1;

	FdPoint3d sV1(0, 0, 0), sV2(0, 0, 22), sV3(0, 0, -38);
	FdPoint3d Cp[2] = { sV1, sV2 };
	FdPoint3d Cp_2[2] = { sV1, sV3 };

	double heightWidth[2] = { u, u };
	double heightWidth_2[2] = { a, a };
	double tubePar[3] = { d, d, 50 };
	double tubePar_2[3] = { d, d, 0 };
	bool sides[4] = { true, true, true, true };
	bool connectors[2] = {false, false};
	int n = 10;

	makeRectToTubeTransition(sV2, vz, vx, heightWidth, sV2, tubePar, n);
	makeRectToTubeTransition(sV1, vz, vx, heightWidth_2, sV1, tubePar_2, n);
	makeBox(count, Cp, heightWidth, heightWidth, false);
	makeBox(count, Cp_2, heightWidth_2, heightWidth_2, sides, connectors, false, true);

	if( ( plenum_box != NULL ) && ( MBZ == NULL ) )
	{
		FdPoint3d base(0, 0, 0);

		makeLIN_BOX(base);
	}
	if( ( MBZ != NULL ) && ( plenum_box != NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 72 + h2), SimT2.set(0, 0, 72) };
		makeVerySimpleTube(cpSimT, d, n);

		float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		
		FdPoint3d base(0, 0, h2);
		FdPoint3d box_MBZ1(base.x, base.y, base.z + h2), box_MBZ2(base.x, base.y, base.z + h2);
		FdPoint3d RecStart(base.x, base.y, base.z + h2);			
		FdPoint3d TubeStart(base.x, base.y, base.z + h2 - B);
		FdPoint3d boxFlat(base.x, base.y, base.z + h2);				
		FdPoint3d CircleFlat(base.x, base.y, base.z + h2);

		makeLIN_BOX(base);
	}
	if( (MBZ != NULL ) && ( plenum_box == NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 72 + h2), SimT2.set(0, 0, 72) };
		makeVerySimpleTube(cpSimT, d, n);
	}

	return 0;
}

short LindabBlockCreator::makeLIN_PCA()
{
	ads_real d, D1, u, plenum_box, MBZ, h2, C_for_geo, B, L;
	get_val("d", d);
	get_val("D1", D1);
	get_val("u", u);
	get_val("plenum_box", plenum_box);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("C_for_geo", C_for_geo);
	get_val("B", B);
	get_val("L", L);

	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, 37),
			  cp3(0, 0, 37),
			  cp4(0, 0, 59),
			  cp5(0, 0, 59),
			  cp6(0, 0, 109);
	FdPoint3d cpPCA[6] = { cp1, cp2, cp3, cp4, cp5, cp6 };
	double diams[6] = { D1, D1, u, u, d, d };
	int n = 10;
	int numSeg = 5;

	makeStraightTube(cpPCA, diams, n, numSeg, true);
	makeFlatDisc(cp1, vz, D1, n);
	FdPoint3d base(0, 0, 0);

	float gap_btw_circ = 15;
	float num_circ = floor( D1 / gap_btw_circ );

/*	for(int i = 0; i < num_circ; i++)
	{
		for(int i = 0; i < num_circ; i++)
		{		
		makeSymbolicCircle(base, vz, 10);						//DO SKOÑCZENIA...!!!!
		base.x += 0;
		base.y -= gap_btw_circ;
		base.z += 0;
	}
		base.set(base.x, 0, 0);
			makeLIN_CIRC(base);
			base.x -= gap_btw_circ;
			base.y += 0;
			base.z += 0;
	}*/

	if( ( plenum_box != NULL ) && ( MBZ == NULL ) )
	{
		FdPoint3d base(0, 0, 37);

		makeLIN_BOX(base);
	}
	if( ( MBZ != NULL ) && ( plenum_box != NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 109 + h2), SimT2.set(0, 0, 109) };
		makeVerySimpleTube(cpSimT, d, n);

		float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		
		FdPoint3d base(0, 0, h2 + 37);
		FdPoint3d box_MBZ1(base.x, base.y, base.z + h2 + 37), box_MBZ2(base.x, base.y, base.z + h2 + 37);
		FdPoint3d RecStart(base.x, base.y, base.z + h2 + 37);			
		FdPoint3d TubeStart(base.x, base.y, base.z + h2 - B + 37);
		FdPoint3d boxFlat(base.x, base.y, base.z + h2 + 37);				
		FdPoint3d CircleFlat(base.x, base.y, base.z + h2 + 37);

		makeLIN_BOX(base);
	}
	if( (MBZ != NULL ) && ( plenum_box == NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 109 + h2), SimT2.set(0, 0, 109) };
		makeVerySimpleTube(cpSimT, d, n);
	}

	return 0;
}

short LindabBlockCreator::makeLIN_LCA()
{
	ads_real d, D1, u, plenum_box, MBZ, h2, C_for_geo, B, L;
	get_val("d", d);
	get_val("D1", D1);
	get_val("u", u);
	get_val("plenum_box", plenum_box);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("C_for_geo", C_for_geo);
	get_val("B", B);
	get_val("L", L);

	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, 37),
			  cp3(0, 0, 37),
			  cp4(0, 0, 59),
			  cp5(0, 0, 59),
			  cp6(0, 0, 109);
	FdPoint3d cpPCA[6] = { cp1, cp2, cp3, cp4, cp5, cp6 };
	double diams[6] = { D1, D1, u, u, d, d };
	int n = 10;
	int numSeg = 5;

	makeStraightTube(cpPCA, diams, n, numSeg, true);
	makeFlatDisc(cp1, vz, D1, n);

	if( ( plenum_box != NULL ) && ( MBZ == NULL ) )
	{
		FdPoint3d base(0, 0, 37);

		makeLIN_BOX(base);
	}
	if( ( MBZ != NULL ) && ( plenum_box != NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 109 + h2), SimT2.set(0, 0, 109) };
		makeVerySimpleTube(cpSimT, d, n);

		float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		
		FdPoint3d base(0, 0, h2 + 37);
		FdPoint3d box_MBZ1(base.x, base.y, base.z + h2 + 37), box_MBZ2(base.x, base.y, base.z + h2 + 37);
		FdPoint3d RecStart(base.x, base.y, base.z + h2 + 37);			
		FdPoint3d TubeStart(base.x, base.y, base.z + h2 - B + 37);
		FdPoint3d boxFlat(base.x, base.y, base.z + h2 + 37);				
		FdPoint3d CircleFlat(base.x, base.y, base.z + h2 + 37);

		makeLIN_BOX(base);
	}
	if( (MBZ != NULL ) && ( plenum_box == NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 109 + h2), SimT2.set(0, 0, 109) };
		makeVerySimpleTube(cpSimT, d, n);
	}

	return 0;
}

short LindabBlockCreator::makeLIN_CRL()
{
	ads_real d, A, B1, C, E, plenum_box, MBZ, h2, B, C_for_geo, L;
	get_val("d", d);
	get_val("A", A);
	get_val("B1", B1);
	get_val("C", C);
	get_val("E", E);
	get_val("plenum_box", plenum_box);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("C_for_geo", C_for_geo);
	get_val("B", B);
	get_val("L", L);

	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, 5),
			  cp3(0, 0, B1 + 5),
			  cp4(0, 0, B1 + 5),
			  cp5(0, 0, B1 + 5 + C);

	FdPoint3d cpCRL[4] = { cp2, cp3, cp4, cp5 };
	double diams[4] = { A, A, d, d };
	int n = 10;
	int numSeg = 3;

	makeStraightTube(cpCRL, diams, n, numSeg, true);
	makeFlatDisc(cp1, vz, E, n);
	
	if( ( plenum_box != NULL ) && ( MBZ == NULL ) )
	{
		FdPoint3d base(0, 0, ( 5 + B1 + C ) - 72);

		makeLIN_BOX(base);
	}
	if( ( MBZ != NULL ) && ( plenum_box != NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 5 + B1 + C + h2), SimT2.set(0, 0, 5 + B1 + C) };
		makeVerySimpleTube(cpSimT, d, n);

		float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		
		FdPoint3d base(0, 0, ( 5 + C + B1 + h2 ) - 72);
		FdPoint3d box_MBZ1(base.x, base.y, base.z + h2 + 5 + B1 + C), box_MBZ2(base.x, base.y, base.z + h2 + 5 + B1 + C);
		FdPoint3d RecStart(base.x, base.y, base.z + h2 + 5 + B1 + C);			
		FdPoint3d TubeStart(base.x, base.y, base.z + h2 - B + 5 + B1 + C);
		FdPoint3d boxFlat(base.x, base.y, base.z + h2 + 5 + B1 + C);				
		FdPoint3d CircleFlat(base.x, base.y, base.z + h2 + 5 + B1 + C);

		makeLIN_BOX(base);
	}
	if( (MBZ != NULL ) && ( plenum_box == NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 5 + B1 + C + h2), SimT2.set(0, 0, 5 + B1 + C) };
		makeVerySimpleTube(cpSimT, d, n);
	}

	return 0;
}

short LindabBlockCreator::makeLIN_PC6() // DOROBIC PERFORACJE!!!!!!!!
{
	ads_real d, A, H1, U, d_disc, D2, plenum_box, MBZ, h2, C_for_geo, B, L;
	get_val("d", d);
	get_val("A", A);
	get_val("H1", H1);
	get_val("U", U);
	get_val("d_disc", d_disc);
	get_val("D2", D2);
	get_val("plenum_box", plenum_box);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("C_for_geo", C_for_geo);
	get_val("B", B);
	get_val("L", L);

	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, 30),
			  cp3(0, 0, 30),
			  cp4(0, 0, 90),
			  cp5(0, 0, 90),
			  cp6(0, 0, H1);

	FdPoint3d cpPC6[6] = { cp1, cp2, cp3, cp4, cp5, cp6 };
	double diams[6] = { A, A, D2, D2, d, d };
	int n = 10;
	int numSeg = 5;

	makeStraightTube(cpPC6, diams, n, numSeg, true);
	makeFlatDisc(cp1, vz, d_disc, n);

	if( ( plenum_box != NULL ) && ( MBZ == NULL ) )
	{
		FdPoint3d base(0, 0, H1 - 72);

		makeLIN_BOX(base);
	}
	if( ( MBZ != NULL ) && ( plenum_box != NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, H1 + h2), SimT2.set(0, 0, H1) };
		makeVerySimpleTube(cpSimT, d, n);

		float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		
		FdPoint3d base(0, 0, ( H1 + h2 ) - 72);
		FdPoint3d box_MBZ1(base.x, base.y, base.z + h2 + H1), box_MBZ2(base.x, base.y, base.z + h2 + H1);
		FdPoint3d RecStart(base.x, base.y, base.z + h2 + H1);			
		FdPoint3d TubeStart(base.x, base.y, base.z + h2 - B + H1);
		FdPoint3d boxFlat(base.x, base.y, base.z + h2 + H1);				
		FdPoint3d CircleFlat(base.x, base.y, base.z + h2 + H1);

		makeLIN_BOX(base);
	}
	if( (MBZ != NULL ) && ( plenum_box == NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, H1 + h2), SimT2.set(0, 0, H1) };
		makeVerySimpleTube(cpSimT, d, n);
	}

	return 0;
}

short LindabBlockCreator::makeLIN_RC14() // DOROBIÆ WIRNIKI!!!!
{
	makeLIN_PC6();

	return 0;
}

short LindabBlockCreator::makeLIN_RC15() // DOROBIÆ WIRNIKI!!!!
{
	makeLIN_PC6();

	return 0;
}

short LindabBlockCreator::makeLIN_NC19() // DOROBIÆ wypustki okr¹g³e z makeVerySimpleTube L=10!!!!
{
	makeLIN_PC6();

	return 0;
}

short LindabBlockCreator::makeLIN_RCG()
{
	ads_real d, D, D2, e, U, e2, _gasket, H1, plenum_box, MBZ, h2, C_for_geo, B, L;
	get_val("d", d);
	get_val("D", D);
	get_val("D2", D2);
	get_val("U", U);
	get_val("e", e);
	get_val("e2", e2);
	get_val("_gasket", _gasket);
	get_val("H1", H1);
	get_val("plenum_box", plenum_box);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("C_for_geo", C_for_geo);
	get_val("B", B);
	get_val("L", L);

	FdPoint3d cp(0, 0, 0),
			  cp2(0, 0, - H1);
	double radius = D2/2;
	double diameter = d/2;
	double diameter2 = _gasket;
	double sweepAngle = 360;
	int n = 10;
	int segm = 10;
	int segm2 = 50;

	makeDonutSection2(cp, -vz, radius, diameter, H1, sweepAngle, 90, segm);
	//makeDonutSection(cp, -vz, -vx, diameter, diameter2, sweepAngle, n, segm2);
	makeGrillType1(cp2, vx, vz, e2, d, U, 30, segm2, 12);

	if( ( plenum_box != NULL ) && ( MBZ == NULL ) )
	{
		FdPoint3d base(0, 0, -72);

		makeLIN_BOX(base);
	}
	if( ( MBZ != NULL ) && ( plenum_box != NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, h2), SimT2.set(0, 0, 0) };
		makeVerySimpleTube(cpSimT, d, n);

		float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		
		FdPoint3d base(0, 0, h2 - 72);
		FdPoint3d box_MBZ1(base.x, base.y, base.z + h2 + H1), box_MBZ2(base.x, base.y, base.z + h2 + H1);
		FdPoint3d RecStart(base.x, base.y, base.z + h2 + H1);			
		FdPoint3d TubeStart(base.x, base.y, base.z + h2 - B + H1);
		FdPoint3d boxFlat(base.x, base.y, base.z + h2 + H1);				
		FdPoint3d CircleFlat(base.x, base.y, base.z + h2 + H1);

		makeLIN_BOX(base);
	}
	if( (MBZ != NULL ) && ( plenum_box == NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, h2), SimT2.set(0, 0, 0) };
		makeVerySimpleTube(cpSimT, d, n);
	}

	return 0;
}

short LindabBlockCreator::makeLIN_LCC()
{
	ads_real d, d_disc, U, plenum_box, MBZ, h2, C_for_geo, B, L, H;
	get_val("d", d);
	get_val("d_disc", d_disc);
	get_val("U", U);
	get_val("plenum_box", plenum_box);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("C_for_geo", C_for_geo);
	get_val("B", B);
	get_val("L", L);
	get_val("H", H);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, 47),
			  cp2(0, 0, 47),
			  cp3(0, 0, 97);

	FdPoint3d cpLCC[4] = { cp, cp1, cp2, cp3 };
	double diams[4] = { U, 400, d, d };
	int n = 10;
	int numSeg = 3;

	makeStraightTube(cpLCC, diams, n, numSeg, true);
	makeFlatDisc(cp, vz, 430, n);
	makeFlatRing(cp, vz, U, d_disc, n);

	if( ( plenum_box != NULL ) && ( MBZ == NULL ) )
	{
		FdPoint3d base(0, 0, 97 - 72);

		makeLIN_BOX(base);
	}
	if( ( MBZ != NULL ) && ( plenum_box != NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 97 + h2), SimT2.set(0, 0, 97) };
		makeVerySimpleTube(cpSimT, d, n);

		float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		
		FdPoint3d base(0, 0, ( 97 + h2 ) - 72);
		FdPoint3d box_MBZ1(base.x, base.y, base.z + h2 + 97), box_MBZ2(base.x, base.y, base.z + h2 + 97);
		FdPoint3d RecStart(base.x, base.y, base.z + h2 + 97);			
		FdPoint3d TubeStart(base.x, base.y, base.z + h2 - B + 97);
		FdPoint3d boxFlat(base.x, base.y, base.z + h2 + 97);				
		FdPoint3d CircleFlat(base.x, base.y, base.z + h2 + 97);

		makeLIN_BOX(base);
	}
	if( (MBZ != NULL ) && ( plenum_box == NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 97 + h2), SimT2.set(0, 0, 97) };
		makeVerySimpleTube(cpSimT, d, n);
	}

	return 0;
}
short LindabBlockCreator::makeLIN_LKP()
{
	ads_real d, d_disc, U, U_inner, plenum_box, MBZ, h2, C_for_geo, B, L, H;
	get_val("d", d);
	get_val("d_disc", d_disc);
	get_val("U", U);
	get_val("U_inner", U_inner);
	get_val("plenum_box", plenum_box);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("C_for_geo", C_for_geo);
	get_val("B", B);
	get_val("L", L);
	get_val("H", H);

	int SegBox = 1;
	int n = 10;

	FdPoint3d cpBox(0, 0, 0),
			  cpBoxBis(0, 0, 1),
			  cpBox1(0, 0, 39);
	FdPoint3d CpBOX[2] = { cpBox, cpBox1 };
	FdPoint3d CpBOX1[2] = { cpBox, cpBoxBis };
	double width[2] = { U_inner, 400 };
	double height[2] = { U_inner, 400 };
	double W1[2] = { U_inner, U_inner };
	bool connector[2] = { false, true };
	bool sides [8] = { false, false, false, false, false, false, false, false };
	makeBox(SegBox, CpBOX1, W1, W1, sides, connector, false, false); 
	makeBox(SegBox, CpBOX, width, height, false);
	
	double RecHeightWidth[2] = { 400, 400 };
	double tubePar[3] = { d, d, 50 };

	double tubePar2[3] = { 0, 0, 0 };
	double RecHeightWidth2[2] = { 440, 440 };

	makeRectToTubeTransition(cpBox1, vz, vx, RecHeightWidth, cpBox1, tubePar, n);
	makeRectToTubeTransition(cpBox, vz, vx, RecHeightWidth2, cpBox, tubePar2, n);

	if( ( plenum_box != NULL ) && ( MBZ == NULL ) )
	{
		FdPoint3d base(0, 0, 89 - 72);

		makeLIN_BOX(base);
	}
	if( ( MBZ != NULL ) && ( plenum_box != NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 89 + h2), SimT2.set(0, 0, 89) };
		makeVerySimpleTube(cpSimT, d, n);

		float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		
		FdPoint3d base(0, 0, ( 89 + h2 ) - 72);
		FdPoint3d box_MBZ1(base.x, base.y, base.z + h2 + 89), box_MBZ2(base.x, base.y, base.z + h2 + 89);
		FdPoint3d RecStart(base.x, base.y, base.z + h2 + 89);			
		FdPoint3d TubeStart(base.x, base.y, base.z + h2 - B + 89);
		FdPoint3d boxFlat(base.x, base.y, base.z + h2 + 89);				
		FdPoint3d CircleFlat(base.x, base.y, base.z + h2 + 89);

		makeLIN_BOX(base);
	}
	if( (MBZ != NULL ) && ( plenum_box == NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 89 + h2), SimT2.set(0, 0, 89) };
		makeVerySimpleTube(cpSimT, d, n);
	}

	return 0;
}
short LindabBlockCreator::makeLIN_LCP()
{
	ads_real d, d_disc, U, U_inner, plenum_box, MBZ, h2, C_for_geo, B, L, H;
	get_val("d", d);
	get_val("d_disc", d_disc);
	get_val("U", U);
	get_val("U_inner", U_inner);
	get_val("plenum_box", plenum_box);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("C_for_geo", C_for_geo);
	get_val("B", B);
	get_val("L", L);
	get_val("H", H);

	int SegBox = 1;
	int n = 10;

	FdPoint3d cpBox(0, 0, 0),
			  cpBoxBis(0, 0, 1),
			  cpBox1(0, 0, 47);
	FdPoint3d CpBOX[2] = { cpBox, cpBox1 };
	FdPoint3d CpBOX1[2] = { cpBox, cpBoxBis };
	double width[2] = { U_inner, 400 };
	double height[2] = { U_inner, 400 };
	double W1[2] = { U_inner, U_inner };
	bool connector[2] = { false, true };
	bool sides [8] = { false, false, false, false, false, false, false, false };
	makeBox(SegBox, CpBOX1, W1, W1, sides, connector, false, false); 
	makeBox(SegBox, CpBOX, width, height, false);
	
	double RecHeightWidth[2] = { 400, 400 };
	double tubePar[3] = { d, d, 50 };

	double tubePar2[3] = { 460, 460, 0 };
	double RecHeightWidth2[2] = { U_inner, U_inner };

	makeRectToTubeTransition(cpBox1, vz, vx, RecHeightWidth, cpBox1, tubePar, n);
	makeRectToTubeTransition(cpBox, vz, vx, RecHeightWidth2, cpBox, tubePar2, n);
	makeFlatDisc(cpBox, vz, 380, n);

	if( ( plenum_box != NULL ) && ( MBZ == NULL ) )
	{
		FdPoint3d base(0, 0, 97 - 72);

		makeLIN_BOX(base);
	}
	if( ( MBZ != NULL ) && ( plenum_box != NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 97 + h2), SimT2.set(0, 0, 97) };
		makeVerySimpleTube(cpSimT, d, n);

		float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
		
		FdPoint3d base(0, 0, ( 97 + h2 ) - 72);
		FdPoint3d box_MBZ1(base.x, base.y, base.z + h2 + 97), box_MBZ2(base.x, base.y, base.z + h2 + 97);
		FdPoint3d RecStart(base.x, base.y, base.z + h2 + 97);			
		FdPoint3d TubeStart(base.x, base.y, base.z + h2 - B + 97);
		FdPoint3d boxFlat(base.x, base.y, base.z + h2 + 97);				
		FdPoint3d CircleFlat(base.x, base.y, base.z + h2 + 97);

		makeLIN_BOX(base);
	}
	if( (MBZ != NULL ) && ( plenum_box == NULL ) )
	{
		FdPoint3d SimT1(0, 0, -h2/2),
				  SimT2(0, 0, h2/2);
		FdPoint3d cpSimT[2] = { SimT1.set(0, 0, 97 + h2), SimT2.set(0, 0, 97) };
		makeVerySimpleTube(cpSimT, d, n);
	}

	return 0;
}
short LindabBlockCreator::makeLIN_PS1()
{
	ads_real d, a, B, d1, plenum_box, H, E, c, gap, plenum_box_MBB, h_box, D, e, W, MBZ, h2, L, h_box_MBZ, C_for_geo, plenum_box_rec, rec_a, a_rec_box, B_box;
	get_val("d", d);
	get_val("a", a);
	get_val("B", B);
	get_val("d1", d1);
	get_val("plenum_box", plenum_box);
	get_val("H", H);
	get_val("E", E);
	get_val("c", c);
	get_val("gap", gap);
	get_val("plenum_box_MBB", plenum_box_MBB);
	get_val("h_box", h_box);
	get_val("D", D);
	get_val("e", e);
	get_val("W", W);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("L", L);
	get_val("h_box_MBZ", h_box_MBZ);
	get_val("C_for_geo", C_for_geo);
	get_val("plenum_box_rec", plenum_box_rec);
	get_val("rec_a", rec_a);
	get_val("a_rec_box", a_rec_box);
	get_val("B_box", B_box);

	int count = 1;
	
	float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
	//float gap_btw_circ = 15;
	//float circ_num = floor( a / gap_btw_circ ) - 1;
	FdPoint3d base(0, 0, 0);

	FdPoint3d cp1(0, 0, -38),
			  cp2(0, 0, 57),
			  cp3(0, 0, ( H + 10 ) - 38),
			  cp4(0, 0, h_box - 38);

	double width[2] = { a, a };
	double height[2] = { a, a };

	if((plenum_box == NULL) && (plenum_box_rec == NULL))
	{
	FdPoint3d cpNoBox[2] = { cp1, cp2 };
	bool connector[2] = { false, false };
	bool sides [6] = { true, true, true, true, true, true };

	makeBox(count, cpNoBox, width, height, sides, connector, true, false);

	double wh[2] = { a, a };
	double tubePar[3] = { d, d, 50 };

	makeRectToTubeTransition(cp2, vz, vx, wh, cp2, tubePar, 10);
	}
	if(plenum_box != NULL)
	{
		double width_box[2] = { B_box, B_box };
		double height_box[2] = { B_box, B_box };
		FdPoint3d cpBox[2] = { cp1, cp3 };
		bool connector[2] = { false, false };
		bool sides2[6] = { false, true, true, true, true, true };
		makeBox(1, cpBox, width_box, height_box, sides2, connector, true, true);

		cp1.set(B_box / 2, 0, ( ( H / 2 ) + 5 ) - 38);				//cp1.set(a / 2, 0, ( ( H / 2 ) + 5 ) - 38);
		cp2.set(B_box / 2, 0, ( H + 5 ) - 38 - d1 / 2 - 20 );		//cp2.set(a / 2, 0, ( H + 5 ) - 38 - d1 / 2 - 20 );
		double wh[2] = { H + 10, B_box };
		double tubePar[3] = { d1, d1, 200 };

	makeRectToTubeTransition(cp1, vx, vz, wh, cp2, tubePar, 10);
	}

	if(plenum_box_rec != NULL)
	{
		double width_rec[2] = { a_rec_box, a_rec_box };
		double height_rec[2] = { a_rec_box, a_rec_box };
		FdPoint3d cpBox[2] = { cp1, cp3 };
		bool connector[2] = { false, false };
		bool sides2[6] = { true, true, true, true, true, true };
		makeBox(1, cpBox, width_rec, height_rec, sides2, connector, true, true);

		double rec_width[2] = { 50, 50 };
		double rec_height[2] = { rec_a, rec_a };

		FdPoint3d rec_box_1( 0, a_rec_box / 2 + 25, H - 10 - 28),
				  rec_box_2( 0, a_rec_box / 2 + 25, H - 110 - 28);
		FdPoint3d cpBoxRec[2] = { rec_box_1, rec_box_2 };
		bool sides_rec[6] = { true, false, true, true, true, true };
		makeBox(1, cpBoxRec, rec_width, rec_height, sides_rec, connector, true, true);
	}

	if((plenum_box_MBB == NULL) && (MBZ != NULL))
	{
	FdPoint3d cpMBZ1(0, 0, 127 + h2 / 2), cpMBZ2(0, 0, 127 - h2 / 2); 
	FdPoint3d cpSimpleTube[2] = { cpMBZ1, cpMBZ2 };

	makeVerySimpleTube(cpSimpleTube, d, 10);
	}

	if((plenum_box_MBB != NULL) && (MBZ != NULL))
	{
	FdPoint3d cpMBZ1(0, 0, 127 + h2 / 2), cpMBZ2(0, 0, 127 - h2 / 2); 
	FdPoint3d cpSimpleTube[2] = { cpMBZ1, cpMBZ2 };

	makeVerySimpleTube(cpSimpleTube, d, 10);

	cpMBZ1.set(move_d, 0, 127 + h2 / 2);
	FdPoint3d cpBoxMBB1(move_d, 0,127 + h2 / 2 + h_box);
	FdPoint3d cpBoxMBB[2] = { cpMBZ1, cpBoxMBB1 };
	double widthMBB[2] = { W, W };
	double heightMBB[2] = { L, L };
	bool connector[2] = { false, false };
	bool sides2[6] = { false, true, true, true, false, true };

	makeBox(1, cpBoxMBB, widthMBB, heightMBB, sides2, connector, true, true);

	double wh[2] = { h_box, W };
	double tubePar[3] = { d1, d1, D };
	FdPoint3d cpMBZ11(move_d + L / 2, 0, 107 + h2 + h_box / 2);
	FdPoint3d cpTube(move_d + L / 2, 0, 107 + h2 + h_box - 10 - d1 / 2);
	
	makeRectToTubeTransition(cpMBZ11, vx, vz, wh, cpTube, tubePar, 10);
	}

	if((plenum_box_MBB != NULL) && (MBZ == NULL))
	{
	FdPoint3d cpMBZ1(move_d, 0, 107);
	FdPoint3d cpBoxMBB1(move_d, 0,107 + h_box);
	FdPoint3d cpBoxMBB[2] = { cpMBZ1, cpBoxMBB1 };
	double widthMBB[2] = { W, W };
	double heightMBB[2] = { L, L };
	bool connector[2] = { false, false };
	bool sides2[6] = { false, true, true, true, false, true };

	makeBox(1, cpBoxMBB, widthMBB, heightMBB, sides2, connector, true, true);

	double wh[2] = { h_box, W };
	double tubePar[3] = { d1, d1, D };
	FdPoint3d cpMBZ11(move_d + L / 2, 0, 107 + h_box / 2);
	FdPoint3d cpTube(move_d + L / 2, 0, 107 + h_box - 10 - d1 / 2);

	makeRectToTubeTransition(cpMBZ11, vx, vz, wh, cpTube, tubePar, 10);
	}
	return 0;
}
short LindabBlockCreator::makeLIN_RS14()
{
	ads_real d, a, B, d1, plenum_box, H, E, c, gap, plenum_box_MBB, h_box, D, e, W, MBZ, h2, L, h_box_MBZ, C_for_geo, plenum_box_rec, rec_a, a_rec_box, B_box;
	get_val("d", d);
	get_val("a", a);
	get_val("B", B);
	get_val("d1", d1);
	get_val("plenum_box", plenum_box);
	get_val("H", H);
	get_val("E", E);
	get_val("c", c);
	get_val("gap", gap);
	get_val("plenum_box_MBB", plenum_box_MBB);
	get_val("h_box", h_box);
	get_val("D", D);
	get_val("e", e);
	get_val("W", W);
	get_val("MBZ", MBZ);
	get_val("h2", h2);
	get_val("L", L);
	get_val("h_box_MBZ", h_box_MBZ);
	get_val("C_for_geo", C_for_geo);
	get_val("plenum_box_rec", plenum_box_rec);
	get_val("rec_a", rec_a);
	get_val("a_rec_box", a_rec_box);
	get_val("B_box", B_box);

	int count = 1;
	
	float move_d = ( L / 2 - d/ 2 ) - ( L - ( C_for_geo + d / 2 ) ); 
	//float gap_btw_circ = 15;
	//float circ_num = floor( a / gap_btw_circ ) - 1;
	FdPoint3d base(0, 0, 0);

	FdPoint3d cp1(0, 0, -38),
			  cp2(0, 0, 57),
			  cp3(0, 0, ( H + 10 ) - 38),
			  cp4(0, 0, h_box - 38);

	double width[2] = { a, a };
	double height[2] = { a, a };

	if((plenum_box == NULL) && (plenum_box_rec == NULL))
	{
	FdPoint3d cpNoBox[2] = { cp1, cp2 };
	bool connector[2] = { false, false };
	bool sides [6] = { true, true, true, true, true, true };

	makeBox(count, cpNoBox, width, height, sides, connector, true, false);

	double wh[2] = { a, a };
	double tubePar[3] = { d, d, 50 };

	makeRectToTubeTransition(cp2, vz, vx, wh, cp2, tubePar, 10);
	}
	if(plenum_box != NULL)
	{
		double width_box[2] = { B_box, B_box };
		double height_box[2] = { B_box, B_box };
		FdPoint3d cpBox[2] = { cp1, cp3 };
		bool connector[2] = { false, false };
		bool sides2[6] = { false, true, true, true, true, true };
		makeBox(1, cpBox, width_box, height_box, sides2, connector, true, true);

		cp1.set(B_box / 2, 0, ( ( H / 2 ) + 5 ) - 38);
		cp2.set(B_box / 2, 0, ( H + 5 ) - 38 - d1 / 2 - 20 );
		double wh[2] = { H + 10, B_box };
		double tubePar[3] = { d1, d1, 200 };

	makeRectToTubeTransition(cp1, vx, vz, wh, cp2, tubePar, 10);
	}

	if(plenum_box_rec != NULL)
	{
		double width_rec[2] = { a_rec_box, a_rec_box };
		double height_rec[2] = { a_rec_box, a_rec_box };
		FdPoint3d cpBox[2] = { cp1, cp3 };
		bool connector[2] = { false, false };
		bool sides2[6] = { true, true, true, true, true, true };
		makeBox(1, cpBox, width_rec, height_rec, sides2, connector, true, true);

		double rec_width[2] = { 50, 50 };
		double rec_height[2] = { rec_a, rec_a };

		FdPoint3d rec_box_1( 0, a_rec_box / 2 + 25, H - 10 - 28),
				  rec_box_2( 0, a_rec_box / 2 + 25, H - 110 - 28);
		FdPoint3d cpBoxRec[2] = { rec_box_1, rec_box_2 };
		bool sides_rec[6] = { true, false, true, true, true, true };
		makeBox(1, cpBoxRec, rec_width, rec_height, sides_rec, connector, true, true);
	}

	if((plenum_box_MBB == NULL) && (MBZ != NULL))
	{
	FdPoint3d cpMBZ1(0, 0, 127 + h2 / 2), cpMBZ2(0, 0, 127 - h2 / 2); 
	FdPoint3d cpSimpleTube[2] = { cpMBZ1, cpMBZ2 };

	makeVerySimpleTube(cpSimpleTube, d, 10);
	}

	if((plenum_box_MBB != NULL) && (MBZ != NULL))
	{
	FdPoint3d cpMBZ1(0, 0, 127 + h2 / 2), cpMBZ2(0, 0, 127 - h2 / 2); 
	FdPoint3d cpSimpleTube[2] = { cpMBZ1, cpMBZ2 };

	makeVerySimpleTube(cpSimpleTube, d, 10);

	cpMBZ1.set(move_d, 0, 127 + h2 / 2);
	FdPoint3d cpBoxMBB1(move_d, 0,127 + h2 / 2 + h_box);
	FdPoint3d cpBoxMBB[2] = { cpMBZ1, cpBoxMBB1 };
	double widthMBB[2] = { W, W };
	double heightMBB[2] = { L, L };
	bool connector[2] = { false, false };
	bool sides2[6] = { false, true, true, true, false, true };

	makeBox(1, cpBoxMBB, widthMBB, heightMBB, sides2, connector, true, true);

	double wh[2] = { h_box, W };
	double tubePar[3] = { d1, d1, D };
	FdPoint3d cpMBZ11(move_d + L / 2, 0, 107 + h2 + h_box / 2);
	FdPoint3d cpTube(move_d + L / 2, 0, 107 + h2 + h_box - 10 - d1 / 2);
	
	makeRectToTubeTransition(cpMBZ11, vx, vz, wh, cpTube, tubePar, 10);
	}

	if((plenum_box_MBB != NULL) && (MBZ == NULL))
	{
	FdPoint3d cpMBZ1(move_d, 0, 107);
	FdPoint3d cpBoxMBB1(move_d, 0,107 + h_box);
	FdPoint3d cpBoxMBB[2] = { cpMBZ1, cpBoxMBB1 };
	double widthMBB[2] = { W, W };
	double heightMBB[2] = { L, L };
	bool connector[2] = { false, false };
	bool sides2[6] = { false, true, true, true, false, true };

	makeBox(1, cpBoxMBB, widthMBB, heightMBB, sides2, connector, true, true);

	double wh[2] = { h_box, W };
	double tubePar[3] = { d1, d1, D };
	FdPoint3d cpMBZ11(move_d + L / 2, 0, 107 + h_box / 2);
	FdPoint3d cpTube(move_d + L / 2, 0, 107 + h_box - 10 - d1 / 2);

	makeRectToTubeTransition(cpMBZ11, vx, vz, wh, cpTube, tubePar, 10);
	}
	return 0;
}
short LindabBlockCreator::makeLIN_NS19()
{
	makeLIN_RS14();
	return 0;
}
short LindabBlockCreator::makeLIN_RS15()
{
	makeLIN_RS14();
	return 0;
}
short LindabBlockCreator::makeLIN_RS16()
{
	makeLIN_RS14();
	return 0;
}
short LindabBlockCreator::makeLIN_RCWB()
{
	ads_real d, A, H, B;
	get_val("d", d);
	get_val("A", A);
	get_val("H", H);
	get_val("B", B);

	FdPoint3d cp1(0, 0, 0);
	double mainTubePar[3] = { A, A, H };
	double interTubePos[2] = { H / 2, 0 };
	double interTubePar[3] = { ( A / 2 + B - ( A / 2 ) ) + 30, d, d };
	double ang[3] = { 90, 90, 0 };
	int n[2] = { 10, 10 };
	bool options[3] = { false, false, false };

	makeTubeToTubeIntersection(cp1, vz, mainTubePar, interTubePos, interTubePar, ang, n, options);

	makeGrillType1(cp1, vx, vz, A / 12, A, A + 10, 15, 50, 12);
	
	cp1.set(0, 0, H);
	makeFlatDisc(cp1, vz, A, 10);

	return 0;
}
short LindabBlockCreator::makeLIN_RCW()
{
	ads_real d, D, U, H, L;
	get_val("d", d);
	get_val("D", D);
	get_val("U", U);
	get_val("H", H);
	get_val("L", L);

	FdPoint3d cp(0, 0, 0);
	double radius = D / 2;
	double diam = d / 2;
	double sweepAng = 360;
	int n = 50;
	int seg = 50;

	makeDonutSection2(cp, -vz, radius, diam, H, sweepAng, 90, 10);
	cp.set(0, 0, -H);
	makeFlatRing(cp, vz, U, D, 10);

	return 0;
}
short LindabBlockCreator::makeLIN_VS5()
{
	ads_real D, Dz, D4, L1, L2;
	get_val("D", D);
	get_val("Dz", Dz);
	get_val("D4", D4);
	get_val("L1", L1);
	get_val("L2", L2);

	FdPoint3d cp(0, 0, 0),
			  cp1(L1, 0, 0),
			  cp2(L1, 0, 0),
			  cp3(L1 + L2, 0, 0);
	FdPoint3d cpVS5[4] = { cp, cp1, cp2, cp3 };
	double diams[4] = { D, D, Dz, D4 };
	makeStraightTube(cpVS5, diams, 10, 3, false);

	return 0;
}
short LindabBlockCreator::makeLIN_DCS()
{
	ads_real d1, H, L, A;
	get_val("d1", d1);
	get_val("A", A);
	get_val("L", L);
	get_val("H", H);

	FdPoint3d cp1(0, 0, 0);
	double mainTubePar[3] = { A, A, H };
	double interTubePos[2] = { H / 2, 0 };
	double interTubePar[3] = { L, d1, d1 };
	double ang[3] = { 90, 90, 0 };
	int n[2] = { 10, 10 };
	bool options[3] = { false, false, false };

	makeTubeToTubeIntersection(cp1, vz, mainTubePar, interTubePos, interTubePar, ang, n, options);

	makeFlatDisc(cp1, vz, A, 10);
	makeFlatDisc(cp1.set(0, 0, H), vz, A, 10);
	
	return 0;
}
short LindabBlockCreator::makeLIN_LCF()
{
	ads_real d1, H, L, A, A1;
	get_val("d1", d1);
	get_val("A", A);
	get_val("L", L);
	get_val("H", H);
	get_val("A1", A1);

	FdPoint3d cp1(0, 0, 0);
	double mainTubePar[3] = { A, A, H - 15 };
	double interTubePos[2] = {H - A1, 0 };
	double interTubePar[3] = { A / 2 + 20, d1, d1 };
	double ang[3] = { 90, 90, 0 };
	int n[2] = { 10, 10 };
	bool options[3] = { false, false, false };

	makeTubeToTubeIntersection(cp1, vz, mainTubePar, interTubePos, interTubePar, ang, n, options);

	makeFlatDisc(cp1.set(0, 0, - 15), vz, A, 10);
	makeFlatDisc(cp1.set(0, 0, H - 15), vz, A, 10);
	
	return 0;
}
short LindabBlockCreator::makeLIN_LCS()
{
	ads_real d1, H, L, A;
	get_val("d1", d1);
	get_val("A", A);
	get_val("L", L);
	get_val("H", H);

	FdPoint3d cp1(0, 0, 0);
	double mainTubePar[3] = { A, A, H };
	double interTubePos[2] = {H / 2, 0 };
	double interTubePar[3] = { L, d1, d1 };
	double ang[3] = { 90, 90, 0 };
	int n[2] = { 10, 10 };
	bool options[3] = { false, false, false };

	makeTubeToTubeIntersection(cp1, vz, mainTubePar, interTubePos, interTubePar, ang, n, options);

	makeFlatDisc(cp1.set(0, 0, - 30), vz, A, 10);
	makeFlatDisc(cp1.set(0, 0, H), vz, A, 10);
	
	return 0;
}
short LindabBlockCreator::makeLIN_LAD()
{
	ads_real A, B, D, E;
	get_val("A", A);
	get_val("B", B);
	get_val("D", D);
	get_val("E", E);

	FdPoint3d cp(0, 0, 0),
			  cp1(E, 0, 0),
			  cp2(E, 0, 0),
			  cp3(B, 0, 0);
	FdPoint3d cpLAD[4] = { cp, cp1, cp2, cp3 };
	double diameter[4] = { D, D, D, A };

	makeStraightTube(cpLAD, diameter, 10, 3, false);
	return 0;
}
short LindabBlockCreator::makeLIN_PCS()
{
	ads_real d1, H, L, D;
	get_val("d1", d1);
	get_val("D", D);
	get_val("L", L);
	get_val("H", H);

	FdPoint3d cp1(0, 0, 0);
	double mainTubePar[3] = { D, D, H };
	double interTubePos[2] = {H / 2, 0 };
	double interTubePar[3] = { L, d1, d1 };
	double ang[3] = { 90, 90, 0 };
	int n[2] = { 10, 10 };
	bool options[3] = { false, false, false };

	makeTubeToTubeIntersection(cp1, vz, mainTubePar, interTubePos, interTubePar, ang, n, options);

	makeFlatDisc(cp1.set(0, 0, - 30), vz, D, 10);
	makeFlatDisc(cp1.set(0, 0, H), vz, D, 10);
	
	return 0;
}
short LindabBlockCreator::makeLIN_AC()
{
	ads_real L, H, Plen_box, box_con_type, con_num, L_box, H_box, A_side, D_side, A_back, D_back, box_con_type_idx;
	get_val("L", L);
	get_val("H", H);
	get_val("Plen_box", Plen_box);
	get_val("box_con_type", box_con_type);
	get_val("con_num", con_num);
	get_val("L_box", L_box);
	get_val("H_box", H_box);
	get_val("A_side", A_side);
	get_val("D_side", D_side);
	get_val("A_back", A_back);
	get_val("D_back", D_back);
	get_val("box_con_type_idx", box_con_type_idx);
	
	if(Plen_box == NULL)
	{
	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, 30);
			  FdPoint3d cpBox[2] = { cp1, cp2 };
	double Width[2] = { L, L };
	double Haight[2] = { H, H };
	makeBox(1, cpBox, Width, Haight, false);
	makeGrillType6(cp1, vz, L, H, 10, H / 12);
	}
	if((Plen_box =! NULL) && (box_con_type_idx == 2) && (con_num == 1))
	{
	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, A_back);
	FdPoint3d cpBox[2] = { cp1, cp2 };
	double WidthHeight[2] = { H_box, L_box };
	double Diams[3] = { D_back, D_back, 50 }; 
	double Width[2] = { L_box, L_box };
	double Height[2] = { H_box, H_box };

	makeGrillType6(cp1, vz, L_box, H_box, 10, H / 12);

	makeBox(1, cpBox, Width, Height, false);
	makeRectToTubeTransition(cp2, vz, vx, WidthHeight, cp2, Diams, 10);
	}
	if((Plen_box =! NULL) && (box_con_type_idx == 2) && (con_num == 2))
	{
	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, A_back);
	FdPoint3d cpBox[2] = { cp1, cp2 };
	double WidthHeight[2] = { H_box, L_box / 2 };
	double Diams[3] = { D_back, D_back, 50 }; 
	double Width[2] = { L_box, L_box };
	double Height[2] = { H_box, H_box };

	makeGrillType6(cp1, vz, L_box, H_box, 10, H / 12);

	makeBox(1, cpBox, Width, Height, false);
	cp2.set(0, L_box / 4, A_back);
	makeRectToTubeTransition(cp2, vz, vx, WidthHeight, cp2, Diams, 10);
	cp2.set(0, - L_box / 4, A_back);
	makeRectToTubeTransition(cp2, vz, vx, WidthHeight, cp2, Diams, 10);
	}
	if((Plen_box =! NULL) && (box_con_type_idx == 1) && (con_num == 1))
	{
	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, A_side);
	FdPoint3d cpBox[2] = { cp1, cp2 };
	double WidthHeight[2] = { A_side, L_box };
	double Diams[3] = { D_side, D_side, 50 }; 
	double Width[2] = { L_box, L_box };
	double Height[2] = { H_box, H_box };
	bool sides[6] = { true, true, false, true, true, true };
	bool connector[2] = { false, false };

	makeGrillType6(cp1, vz, L_box, H_box, 10, H / 12);

	makeBox(1, cpBox, Width, Height, sides, connector, false, true);

	cp2.set(H_box / 2, 0, A_side / 2);
	makeRectToTubeTransition(cp2, vx, vz, WidthHeight, cp2, Diams, 10);
	}
	if((Plen_box =! NULL) && (box_con_type_idx == 1) && (con_num == 2))
	{
	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, A_side);
	FdPoint3d cpBox[2] = { cp1, cp2 };
	double WidthHeight[2] = { A_side, L_box / 2 };
	double Diams[3] = { D_side, D_side, 50 };
	double Width[2] = { L_box, L_box };
	double Height[2] = { H_box, H_box };
	bool sides[6] = { false, true, true, true, false, false };
	bool connector[2] = { false, false };

	makeGrillType6(cp1, vz, L_box, H_box, 10, H / 12);

	makeBox(1, cpBox, Width, Height, sides, connector, false, true);

	cp2.set(H_box / 2, L_box / 4, A_side / 2);
	makeRectToTubeTransition(cp2, vx, vz, WidthHeight, cp2, Diams, 10);

	cp2.set(H_box / 2, - L_box / 4, A_side / 2);
	makeRectToTubeTransition(cp2, vx, vz, WidthHeight, cp2, Diams, 10);
	}
	return 0;
}
short LindabBlockCreator::makeLIN_F50()
{
	ads_real d, D, C, H, U;
	get_val("d", d);
	get_val("D", D);
	get_val("C", C);
	get_val("H", H);
	get_val("U", U);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, 9),
			  cp2(0, 0, 9),
			  cp3(0, 0, H);
	FdPoint3d cpF50[6] = { cp, cp1, cp2, cp3 };
	double diameter[6] = { D, D, d, d };

	makeStraightTube(cpF50, diameter, 10, 3, false);
	makeFlatRing(cp, vz, U, D, 10);
	cp.set(0, 0, - 2);
	makeFlatDisc(cp, vz, d, 10);

	return 0;
}
short LindabBlockCreator::makeLIN_WLS()
{
	ads_real L, H;
	get_val("L", L);
	get_val("H", H);

	FdPoint3d cp(0, 0, 0);

	makeGrillType7(cp, vz, L, H, 10, 30, 10);

	return 0;
}
short LindabBlockCreator::makeLIN_CCU()
{
	ads_real d1, A, H, H1;
	get_val("d1", d1);
	get_val("A", A);
	get_val("H", H);
	get_val("H1", H1);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, H1 - 10),
			  cp2(0, 0, H1 - 10),
			  cp3(0, 0, H1);
	FdPoint3d cpCCU[4] = { cp, cp1, cp2, cp3 };
	double diams[4] = { d1, d1, A, A };

	makeStraightTube(cpCCU, diams, 10, 3, false);

	FdPoint3d cp4(0, 0, ( H1 + H ) - 5 );
	makeDisc(cp4, vz, A, 10, 10, false);

	return 0;
}
short LindabBlockCreator::makeLIN_CRP()
{
	ads_real A, B, l1, l2, A1, B1;
	get_val("A", A);
	get_val("B", B);
	get_val("A1", A1);
	get_val("B1", B1);
	get_val("l1", l1);
	get_val("l2", l2);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, l2);
	FdPoint3d cpBOX_1[2] = { cp, cp1 };
	double width1[2] = { A, A };
	double height1[2] = { B, B };
	bool sides[6] = { true, true, true, true, true, true };
	bool connector[2] = { false, false };

	makeBox(1, cpBOX_1, width1, height1, sides, connector, true, true); 

	FdPoint3d cp2(0, 0, l1 + l2);
	FdPoint3d cpBOX_2[2] = { cp1, cp2 };
	double width2[2] = { A1, A1 };
	double height2[2] = { B1, B1 };
	bool sides_2[6] = { true, true, true, true, true, true };
	bool connector_2[2] = { false, false };

	makeBox(1, cpBOX_2, width2, height2, sides_2, connector_2, false, false);

	return 0;
}
short LindabBlockCreator::makeLIN_CRU()
{
	ads_real A, B, l1, l2, A1, B1, d1;
	get_val("A", A);
	get_val("B", B);
	get_val("A1", A1);
	get_val("B1", B1);
	get_val("l1", l1);
	get_val("l2", l2);
	get_val("d1", d1);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, l2);
	FdPoint3d cpBOX_1[2] = { cp, cp1 };
	double width1[2] = { A, A };
	double height1[2] = { B, B };
	bool sides[6] = { true, true, true, true, true, true };
	bool connector[2] = { false, false };

	makeBox(1, cpBOX_1, width1, height1, sides, connector, true, true); 

	FdPoint3d cp2(0, 0, l1 + l2);
	FdPoint3d cpBOX_2[2] = { cp1, cp2 };
	double width2[2] = { A1, A1 };
	double height2[2] = { B1, B1 };
	bool sides_2[6] = { true, true, true, true, true, true };
	bool connector_2[2] = { false, false };

	makeBox(1, cpBOX_2, width2, height2, sides_2, connector_2, false, false);

	double heightWidth[2] = { B1, A1 };
	double tubeDiams[3] = { d1, d1, 30 };

	makeRectToTubeTransition(cp2, vz, vx, heightWidth, cp2, tubeDiams, 10);

	return 0;
}
short LindabBlockCreator::makeLIN_CBA()
{
	ads_real A, D, H;
	get_val("A", A);
	get_val("D", D);
	get_val("H", H);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, H);
	FdPoint3d cp_CBA[4] = { cp, cp, cp1, cp1 };
	FdVector3d vt[4] = { vz, vz, vz ,vz };
	FdVector3d upvt[4] = { vx, vx, vx, vx };
	double diam[4][2] = { 0, 0, A, A, A, A, 0, 0 };

	makeTube(cp_CBA, vt, upvt, diam, 10, 3, true, true);

	FdPoint3d cp_box[2] = { cp, cp1 };
	double Wid[2] = { 0.1, 0.1 };
	double Hei[2] = { A, A };

	makeBox(1, cp_box, Wid, Hei, false);

	cp.set(0, D / 2 + 10, H);
	cp1.set(0, D / 2 + 10, H + 10);
	FdPoint3d cp_tube[2] = { cp, cp1 };

	makeVerySimpleTube(cp_tube, D, 10);

	return 0;
}
short LindabBlockCreator::makeLIN_CHA()
{
	ads_real A, D, H;
	get_val("A", A);
	get_val("D", D);
	get_val("H", H);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, H);
	FdPoint3d cp_CBA[4] = { cp, cp, cp1, cp1 };
	FdVector3d vt[4] = { vz, vz, vz ,vz };
	FdVector3d upvt[4] = { vx, vx, vx, vx };
	double diam[4][2] = { 0, 0, A, A, A, A, 0, 0 };

	makeTube(cp_CBA, vt, upvt, diam, 10, 3, true, true);

	cp.set(0, - A / 4, 0);
	cp1.set(0, - A / 4, H);
	FdPoint3d cp_box[2] = { cp, cp1 };
	double Wid[2] = { A / 2, A / 2 };
	double Hei[2] = { A, A };
	bool sides [6] = { true, true, true, true, true, true };
	bool con[2] = { false, false };

	makeBox(1, cp_box, Wid, Hei, sides, con, true, true);

	cp.set(0, 0, H);
	cp1.set(0, 0, H + 10);
	FdPoint3d cp_tube[2] = { cp, cp1 };

	makeVerySimpleTube(cp_tube, D, 10);

	return 0;
}
short LindabBlockCreator::makeLIN_CQA()
{
	ads_real A, D, H, B, C_for_geo, new_box;
	get_val("A", A);
	get_val("D", D);
	get_val("H", H);
	get_val("B", B);
	get_val("C_for_geo", C_for_geo),
	get_val("new_box", new_box);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, H),
			  cp2(0, 0, H / 2);

	FdPoint3d cp_CBA[4] = { cp, cp, cp1, cp1 };
	FdVector3d vt[4] = { vz, vz, vz ,vz };
	FdVector3d upvt[4] = { vx, vx, vx, vx };
	double diam[4][2] = { 0, 0, A, A, A, A, 0, 0 };

	makeTube(cp_CBA, vt, upvt, diam, 10, 3, true, true);
	
	cp.set(0, - new_box, H / 2);
	cp1.set(0, - C_for_geo - new_box, H / 2);
	FdPoint3d cp_box[2] = { cp, cp1 };
	FdPoint3d cp_box_2[2] = { cp, cp2 };
	double Wid[2] = { H, H };
	double Hei[2] = { A, 20 };
	double Hei_2[2] = {A, A };
	bool sides [6] = { true, true, true, true, true, true };
	bool con[2] = { false, false };
	FdVector3d vx_box[2] = { vy, vy };

	makeBox(1, cp_box, vx_box, Wid, Hei, sides, con, true, true);
	makeBox(1, cp_box_2, vx_box, Wid, Hei_2, sides, con, true, true);
	cp.set(0, 0, H);
	cp1.set(0, 0, H + 10);
	FdPoint3d cp_tube[2] = { cp, cp1 };

	makeVerySimpleTube(cp_tube, D, 10);

	return 0;
}
short LindabBlockCreator::makeLIN_CCA() // DO ZROBIENIA 
{
	ads_real A, D, H;
	get_val("A", A);
	get_val("D", D);
	get_val("H", H);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, H),
			  cp2(0, 0, H),
			  cp3(0, 0, H + 10);
	FdPoint3d cp_CCA[4] = { cp, cp1, cp2, cp3 };
	FdVector3d vt[4] = { vz, vz, vz ,vz };
	FdVector3d upvt[4] = { vx, vx, vx, vx };
	double diam[4] = { A, A, D, D };

	makeStraightTube(cp_CCA, diam, 10, 3, false);

	return 0;
}
short LindabBlockCreator::makeLIN_CRA()
{
	ads_real A, B, C, D, H3, circ_red, D1;
	get_val("A", A);
	get_val("B", B);
	get_val("C", C);
	get_val("D", D);
	get_val("H3", H3);
	get_val("circ_red", circ_red);
	get_val("D1", D1);

	FdPoint3d cp(0, 0, 0),
	          cp1(0, 0, H3),
	          cp2(0, 26, H3),
	          cp3(0, 26, H3 + 50);
	FdPoint3d cp_BOX_CRA_1[2] = { cp, cp1 };
	FdPoint3d cp_BOX_CRA_2[2] = { cp2, cp3 };
	FdVector3d vectors[4] = { vz, vz, vz, vz };
	double Width[2] = { C, C };
	double Height[2] = { A, A };
	double Width_2[2] = { D, D };
	double Height_2[2] = { B, B };
	bool sides[6] = { true, true, true, true, true, true };
	bool sides_2[6] = { true, true, true, true, true, false };
	bool connector[2] = { false, false };

	if( circ_red == NULL )
	{
		makeBox(1, cp_BOX_CRA_1, vectors, Width, Height, sides, connector, true, true);
		makeBox(1, cp_BOX_CRA_2, vectors, Width_2, Height_2, sides_2, connector, false, false);
	}
	else if( circ_red == 1 )
	{
		makeBox(1, cp_BOX_CRA_1, vectors, Width, Height, sides, connector, true, true);
		makeBox(1, cp_BOX_CRA_2, vectors, Width_2, Height_2, sides_2, connector, false, false);

		FdPoint3d cp4(0, C / 2,      H3 - D1 / 2 - 25),
		          cp5(0, C / 2 + 25, H3 - D1 / 2 - 25);
		FdPoint3d cpTube[2] = { cp4, cp5 };
		makeVerySimpleTube(cpTube, D1, 10);
	}

	return 0;
}
short LindabBlockCreator::makeLIN_CVA()
{
	ads_real A, B, D, H3, circ_red, D1;
	get_val("A", A);
	get_val("B", B);
	get_val("D", D);
	get_val("H3", H3);
	get_val("circ_red", circ_red);
	get_val("D1", D1);

	FdPoint3d cp(0, 0, 0),
	          cp1(0, 0, H3),
	          cp2(0, -D / 2 - 8,         20),
	          cp3(0, -D / 2 - 8,    H3 - 20),
	          cp4(0, -D / 2 - 20.5, H3 - 20),
	          cp5(0, -D / 2 - 20.5, H3 + 10);

	FdPoint3d cp_BOX_CVA_1[2] = { cp, cp1 };
	FdPoint3d cp_BOX_CVA_2[2] = { cp2, cp3 };
	FdPoint3d cp_BOX_CVA_3[2] = { cp4, cp5 };
	FdVector3d vectors[4] = { vz, vz, vz, vz };
	double Width[2] = { 16, 16 };
	double Height[2] = { A, A };
	double Width_2[2] = { D, D };
	double Height_2[2] = { A - 40, A - 40 };
	double Width_3[2] = { B, B };
	bool sides[6] = { true, true, true, true, true, true };
	bool sides_2[6] = { true, true, true, true, true, false };
	bool connector[2] = { false, false };

	if( circ_red == NULL )
	{
		makeBox(1, cp_BOX_CVA_1, vectors, Width, Height, sides, connector, true, true);
		makeBox(1, cp_BOX_CVA_2, vectors, Width_2, Height_2, sides_2, connector, true, true);
		makeBox(1, cp_BOX_CVA_3, vectors, Width_3, Height_2, sides_2, connector, true, false);
	}
	else if( circ_red == 1 )
	{
		makeBox(1, cp_BOX_CVA_1, vectors, Width, Height, sides, connector, true, true);
		makeBox(1, cp_BOX_CVA_2, vectors, Width_2, Height_2, sides_2, connector, true, true);
		makeBox(1, cp_BOX_CVA_3, vectors, Width_3, Height_2, sides_2, connector, true, false);

		FdPoint3d cp6(0, - D - 8,  H3 - D1 / 2 - 25),
		          cp7(0, - D - 33, H3 - D1 / 2 - 25);
		FdPoint3d cpTube[2] = { cp6, cp7 };
		makeVerySimpleTube(cpTube, D1, 10);
	}

	return 0;
}
short LindabBlockCreator::makeLIN_CEA()
{
	ads_real A, B, D, H;
	get_val("A", A);
	get_val("B", B);
	get_val("D", D);
	get_val("H", H);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, H);
	FdPoint3d cp_BOX_CEA_1[2] = { cp, cp1 };
	FdVector3d vectors[2] = { vz, vz };
	double Width[2] = { B + 16, B + 16 };
	double Height[2] = { A, A };
	bool sides[6] = { true, true, true, true, true, false };
	bool connector[2] = { false, false };
	double heightWidth[2] = { A, B + 16 };
	double tubeDiams[3] = { D, D, 25 };

	makeBox(1, cp_BOX_CEA_1, vectors, Width, Height, sides, connector, true, false);
	makeRectToTubeTransition(cp1, vz, vx, heightWidth, cp1, tubeDiams, 10);

	return 0;
}
short LindabBlockCreator::makeLIN_CKA()
{
	ads_real A, D, H;
	get_val("A", A);
	get_val("D", D);
	get_val("H", H);

	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, H);
	FdPoint3d cp_BOX_CKA_1[2] = { cp, cp1 };
	FdVector3d vectors[2] = { vz, vz };
	double Width[2] = { A + 10, A + 10 };
	double Height[2] = { A, A + 10 };
	bool sides[6] = { true, true, true, true, true, false };
	bool connector[2] = { false, false };
	double tubeDiams[3] = { D, D, 25 };

	makeBox(1, cp_BOX_CKA_1, vectors, Width, Height, sides, connector, true, false);
	makeRectToTubeTransition(cp1, vz, vx, Width, cp1, tubeDiams, 10);

	return 0;
}
short LindabBlockCreator::makeLIN_CBAL()
{
	ads_real L, A, D, con_num;
	get_val("L", L);
	get_val("A", A);
	get_val("D", D);
	get_val("con_num", con_num);

	float H = 405 / 2.0;

	if(con_num == 1)
	{
	FdPoint3d cp_con_1(540 / 2, 0, H);
	double Width_con[2] = { L - 60, 405 };
	double tubeDiams_con[3] = { D, D, 0 };

	makeRectToTubeTransition(cp_con_1, vx, vy, Width_con, cp_con_1, tubeDiams_con, 10);
	}
	else if( con_num == 2)
	{
	FdPoint3d cp_con_1_bis(540 / 2, L / 4 - 15, H),
			  cp_con_2_bis(540 / 2, - L / 4 + 15, H),
			  cp_tube_start_1(540 / 2,( L / 2 - 30 ) - A, H),
			  cp_tube_start_2(540 / 2,( - L / 2 + 30 ) + A, H);
	double Width_con[2] = { L / 2 - 30, 405 };
	double tubeDiams_con[3] = { D, D, 0 };

	makeRectToTubeTransition(cp_con_1_bis, vx, vy, Width_con, cp_tube_start_1, tubeDiams_con, 10);
	makeRectToTubeTransition(cp_con_2_bis, vx, vy, Width_con, cp_tube_start_2, tubeDiams_con, 10);
	}
	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, 405);
	FdPoint3d cp_BOX_CBAL_1[2] = { cp, cp1 };
	FdVector3d vectors[2] = { vz, vz };
	double Width[2] = { L - 60, L - 60 };
	double Height[2] = { 540, 540 };
	bool sides[6] = { false, true, true, true, true, true };
	bool connector[2] = { false, false };

	makeBox(1, cp_BOX_CBAL_1, vectors, Width, Height, sides, connector, true, true);

	FdPoint3d cpTube_1(0,- L / 2, 0),
			  cpTube_2(0, L / 2, 0);
	FdPoint3d cp_CBAL[4] = { cpTube_1, cpTube_1, cpTube_2, cpTube_2 };
	FdVector3d vt[4] = { vy, vy, vy ,vy };
	FdVector3d upvt[4] = { vx, vx, vx, vx };
	double diam[4][2] = { 0, 0, 600, 600, 600, 600, 0, 0 };

	makeTube(cp_CBAL, vt, upvt, diam, 10, 3, true, true);

	return 0;
}
short LindabBlockCreator::makeLIN_CBAV()
{
	ads_real L, A, D, con_num;
	get_val("L", L);
	get_val("A", A);
	get_val("D", D);
	get_val("con_num", con_num);

	float H = 365 / 2.0;

	if( con_num == 1 )
	{
		FdPoint3d cp_con_1(0, 0, 650 - 360),
		          cp_con_2(0, 0, 650 - 360 + 30);
		FdPoint3d cp_TUBE_1[2] = { cp_con_1, cp_con_2 };
		double Width_con[2] = { 365, L };
		double tubeDiams_con[3] = { D, D, 0 };

		makeRectToTubeTransition(cp_con_1, vz, vx, Width_con, cp_con_1, tubeDiams_con, 10);
		makeVerySimpleTube(cp_TUBE_1, D, 10);
	}
	else if( con_num == 2 )
	{
		FdPoint3d cp_con_1_bis(0,  L / 4, 650 - 360),
		          cp_con_2_bis(0, -L / 4, 650 - 360),
		          cp_tube_start_1(0, L / 2 - A, 650 - 360),
		          cp_tube_start_1_bis(0, L / 2 - A, 650 - 360 + 30),
		          cp_tube_start_2(0, -L / 2 + A, 650 - 360),
		          cp_tube_start_2_bis(0, -L / 2 + A, 650 - 360 + 30);
		FdPoint3d cp_TUBE_11[2] = { cp_tube_start_1, cp_tube_start_1_bis };
		FdPoint3d cp_TUBE_12[2] = { cp_tube_start_2, cp_tube_start_2_bis };

		double Width_con[2] = { 365, L / 2 };
		double tubeDiams_con[3] = { D, D, 0 };

		makeRectToTubeTransition(cp_con_1_bis, vz, vx, Width_con, cp_tube_start_1, tubeDiams_con, 10);
		makeRectToTubeTransition(cp_con_2_bis, vz, vx, Width_con, cp_tube_start_2, tubeDiams_con, 10);
		makeVerySimpleTube(cp_TUBE_11, D, 10);
		makeVerySimpleTube(cp_TUBE_12, D, 10);
	}

	FdPoint3d cp(0, 0, 0),
	          cp1(0, 0, 650 - 360);
	FdPoint3d cp_BOX_CBAL_1[2] = { cp, cp1 };
	FdVector3d vectors[2] = { vz, vz };
	double Width[2] = { L, L };
	double Height[2] = { 365, 365 };
	bool sides[6] = { true, true, true, true, false, true };
	bool connector[2] = { false, false };

	makeBox(1, cp_BOX_CBAL_1, vectors, Width, Height, sides, connector, true, false);

	FdPoint3d cpBend_1(0, -L / 2, 0),
	          cpBend_2(0,  L / 2, 0);
	FdPoint3d cp_CBAL[2] = { cpBend_1, cpBend_2 };
	FdVector3d vt[4] = { vy, vy, vy ,vy };
	FdVector3d upvt[4] = { vz, vz, vz, vz };
	bool sides_bend[6] = { true, true, true, true, true, true };

	makeBend(cp, vz, vy, sides_bend, 90, 90, 365, L, 360, 365, 0, 0);
	return 0;
}
short LindabBlockCreator::makeLIN_DR24()
{
	ads_real d1, A, B, L1, L2, con_idx, move;
	get_val("d1", d1);
	get_val("A", A);
	get_val("B", B);
	get_val("L1", L1);
	get_val("L2", L2);
	get_val("con_idx", con_idx);
	get_val("move", move);

	if(con_idx == 1)
	{
	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, L1 + move),
			  cp2(0, 0, ( L1 + move ) + 100);
	FdPoint3d cp_DR24[2] = { cp, cp1 };
	FdVector3d vect[2] = { vz, vz };
	double Width_dr24[2] = { A, A };
	double Height_dr24[2] = { B, B };
	bool sides[6] = { true, true, true, true, false, true };
	bool connector[2] = { false, false };

	makeBox(1, cp_DR24, vect, Width_dr24, Height_dr24, sides, connector, false, true);

	makeGrillType6(cp, - vz, A, B, 10, 10);
	FdPoint3d cp_TUBE[2] = { cp1, cp2 };

	makeVerySimpleTube(cp_TUBE, d1, 10);
	}
	else if(con_idx == 2)
	{
	FdPoint3d cp(0, 0, 0),
			  cp1(0, 0, L2 + move),
			  cp2(0, 0, ( L2 + move ) + 100);
	FdPoint3d cp_DR24[2] = { cp, cp1 };
	FdVector3d vect[2] = { vz, vz };
	double Width_dr24[2] = { A, A };
	double Height_dr24[2] = { B, B };
	bool sides[6] = { true, true, true, true, false, true };
	bool connector[2] = { false, false };

	makeBox(1, cp_DR24, vect, Width_dr24, Height_dr24, sides, connector, false, true);
	
	FdPoint3d cp_tube_1(0, A / 2, L2 + move - 20 - d1 / 2),
			  cp_tube_2(0, A / 2 + 100, L2 + move - 20 - d1 / 2);

	makeGrillType6(cp, - vz, A, B, 10, 10);

	FdPoint3d cp_tube_DR24[2] = { cp_tube_1, cp_tube_2 };

	makeVerySimpleTube(cp_tube_DR24, d1, 10);
	}

	return 0;
}
short LindabBlockCreator::makeLIN_AIRY()
{
	ads_real d_nom, A, B, l, D, geo_idx;
	get_val("d_nom", d_nom);
	get_val("A", A);
	get_val("B", B);
	get_val("l", l);
	get_val("D", D);
	get_val("geo_idx", geo_idx);

	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, l - 10),
			  cp2_bis(0, 0, l - 10),
			  cp3(0, 0, l),
			  cp4(0, 0, l + 8),
			  cp5(0, 0, l + 10);
	FdPoint3d cpAIRY[4] = { cp1, cp2, cp2_bis, cp3 };
	double diams[4] = { d_nom, d_nom, D, D };
	int n = 10;
	int numSeg = 3;

	makeStraightTube(cpAIRY, diams, n, numSeg, true);

	if(geo_idx == 1)
	{
	FdPoint3d cpBOX[2] = { cp4, cp5 };
	double Wit[2] = { A, A };
	double Hai[2] = { B, B };
	bool sides[6] = { true, true, true, true };
	bool conn[2] = { false, false };
		makeBox(1, cpBOX, Wit, Hai, sides, conn, true, true);

	}else if(geo_idx == 2)
	{
		makeFlatDisc(cp4, vz, A, n);
	}

	return 0;
}
short LindabBlockCreator::makeLIN_KI()
{
	ads_real d, D;
	get_val("d", d);
	get_val("D", D);

	FdPoint3d cp1(0, 0, 0),
			  cp2(0, 0, 30),
			  cp2_bis(0, 0, 30),
			  cp3(0, 0, 30 + 20),
			  cp4(0, 0, 50 + 8);

	FdPoint3d cpKI[4] = { cp1, cp2, cp2_bis, cp3 };
	double diams[4] = { d, d, D, D };
	int n = 10;
	int numSeg = 3;

	makeStraightTube(cpKI, diams, n, numSeg, true);
	makeFlatDisc(cp4, vz, D, n);

	return 0;
}
short LindabBlockCreator::makeLIN_KU()
{
	ads_real d, l, D;
	get_val("d", d);
	get_val("l", l);
	get_val("D", D);

	return 0;

}
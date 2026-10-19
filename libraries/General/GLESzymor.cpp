#include "StdAfx.h"
#include "GeoGeneral3D.h"

#define SzymorBlockCreator SmkGenBlockCreator

#define vx FdVector3d::kXAxis
#define vy FdVector3d::kYAxis
#define vz FdVector3d::kZAxis

int _n = 4;

short SzymorBlockCreator::makestirrups_1(const FdPoint3d &base)
{
	ads_real A, B, rob_d, str_d, in_rf;

	get_val("A", A);
	get_val("B", B);
	get_val("rob_d", rob_d);
	get_val("str_d", str_d);
	get_val("in_rf", in_rf);

		//float first_gap = 0.333 * str_gap;
		//float str_height = first_gap + str_d;
		//float str_num = floor( B / str_height);

	//const FdPoint3d &offs double diameter, bool opt
	
		FdPoint3d Cpstrz_1(base.x + B / 4, base.y + A / 4, base.z);
		makeDonutSection(Cpstrz_1, vz, vx, (rob_d / 2) + (str_d / 2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_1BIS(base.x - B / 12, base.y + A / 4 + rob_d / 2 - in_rf / 2, base.z);
		makeDonutSection(Cpstrz_1BIS, vz, vy, (in_rf/2)+(str_d/2), str_d, 90, _n, _n);

		FdPoint3d Cpstrz_2(base.x + B / 4, base.y - A / 4, base.z);
		makeDonutSection(Cpstrz_2, vz, -vy, (rob_d / 2) + (str_d / 2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_2BIS(base.x -B/12, base.y -A/4-rob_d/2+in_rf/2, base.z);
		makeDonutSection(Cpstrz_2BIS, vz, -vy, (in_rf/2)+(str_d/2), str_d, -90, _n, _n);

		FdPoint3d Cpstrz_3(base.x -B/4, base.y -A/4, base.z + str_d);
		makeDonutSection(Cpstrz_3, vz, -vy, (rob_d/2)+(str_d/2), str_d, -90, _n, _n);
		
		FdPoint3d Cpstrz_3BIS(base.x + B/12, base.y -A/4-rob_d/2+in_rf/2, base.z + str_d);
		makeDonutSection(Cpstrz_3BIS, vz, -vy, (in_rf/2)+(str_d/2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_4(base.x -B/4, base.y + A/4, base.z + str_d);
		makeDonutSection(Cpstrz_4, vz, vy, (rob_d/2)+(str_d/2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_4BIS(base.x + B/12, base.y + A/4+rob_d/2-in_rf/2, base.z + str_d);
		makeDonutSection(Cpstrz_4BIS, vz, vy, (in_rf/2)+(str_d/2), str_d, -90, _n, _n);

		FdPoint3d strz_tube_1(base.x -B/12, base.y + A/4+rob_d/2+str_d/2, base.z),
				  strz_tube_2(base.x + B/4, base.y + A/4+rob_d/2+str_d/2, base.z);
		FdPoint3d strz_t_1[2] = { strz_tube_1, strz_tube_2 };
		makeVerySimpleTube(strz_t_1, str_d, _n);

		FdPoint3d strz_tube_3(base.x - B / 12, base.y -A/4-rob_d/2-str_d/2, base.z),
				  strz_tube_4(base.x + B/4, base.y -A/4-rob_d/2-str_d/2, base.z);
		FdPoint3d strz_t_2[2] = { strz_tube_3, strz_tube_4 };
		makeVerySimpleTube(strz_t_2, str_d, _n);

		FdPoint3d strz_tube_5(base.x - B/12-in_rf/2-str_d/2, base.y + A/4+rob_d/2-in_rf/2, base.z),
				  strz_tube_6(base.x - B/12-in_rf/2-str_d/2, base.y -A/4-rob_d/2+in_rf/2, base.z);
		FdPoint3d strz_t_3[2] = { strz_tube_5, strz_tube_6 };
		makeVerySimpleTube(strz_t_3, str_d, _n); 

		FdPoint3d strz_tube_7(base.x + B/4+rob_d/2+str_d/2, base.y + A/4, base.z),
				  strz_tube_8(base.x + B/4+rob_d/2+str_d/2, base.y - A/4, base.z);
		FdPoint3d strz_t_4[2] = { strz_tube_7, strz_tube_8 };
		makeVerySimpleTube(strz_t_4, str_d, _n);

		FdPoint3d str_tube_9(base.x + B/12+str_d/2+in_rf/2, base.y + A/4+rob_d/2-in_rf/2, base.z + str_d),
				  str_tube_10(base.x + B/12+str_d/2+in_rf/2, base.y - A/4-rob_d/2+in_rf/2, base.z + str_d);
		FdPoint3d strz_t_5[2] = { str_tube_9, str_tube_10 };
		makeVerySimpleTube(strz_t_5, str_d, _n);

		FdPoint3d str_tube_11(base.x - B/4-rob_d/2-str_d/2, base.y + A/4, base.z + str_d),
				  str_tube_12(base.x -B/4-rob_d/2-str_d/2, base.y - A/4, base.z + str_d);
		FdPoint3d str_t_6[2] = { str_tube_11, str_tube_12 };
		makeVerySimpleTube(str_tube_11, str_tube_12, str_d, _n);

		FdPoint3d str_tube_13(base.x - B/4, base.y + A/4+rob_d/2+str_d/2, base.z + str_d),
				  str_tube_14(base.x + B/12, base.y + A/4+rob_d/2+str_d/2, base.z + str_d);
		FdPoint3d str_t_7[2] = { str_tube_13, str_tube_14 };
		makeVerySimpleTube(str_t_7, str_d, _n);

		FdPoint3d str_tube_15(base.x - B/4, base.y - A/4-rob_d/2-str_d/2, base.z + str_d),
				  str_tube_16(base.x + B/12, base.y - A/4-rob_d/2-str_d/2, base.z + str_d);
		FdPoint3d str_t_8[2] = { str_tube_15, str_tube_16 };
		makeVerySimpleTube(str_t_8, str_d, _n);

		return 0;
}
short SzymorBlockCreator::makestirrups_2(const FdPoint3d &base_2)
{
	ads_real A, B, rob_d, str_d, in_rf, rob_lvl;

	get_val("A", A);
	get_val("B", B);
	get_val("rob_d", rob_d);
	get_val("str_d", str_d);
	get_val("in_rf", in_rf);
	get_val("rob_lvl", rob_lvl);

		//float first_gap = 0.333 * str_gap;
		//float str_height = first_gap + str_d;
		//float str_num = floor( B / str_height);

	//const FdPoint3d &offs double diameter, bool opt
	
		FdPoint3d Cpstrz_1(base_2.x + B / 4, base_2.y + A / 4, base_2.z);
		makeDonutSection(Cpstrz_1, vz, vx, (rob_d / 2) + (str_d / 2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_1BIS(base_2.x - B / 12, base_2.y + A / 4 + rob_d / 2 - in_rf / 2, base_2.z);
		makeDonutSection(Cpstrz_1BIS, vz, vy, (in_rf/2)+(str_d/2), str_d, 90, _n, _n);

		FdPoint3d Cpstrz_2(base_2.x + B / 4, base_2.y - A / 4, base_2.z);
		makeDonutSection(Cpstrz_2, vz, -vy, (rob_d / 2) + (str_d / 2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_2BIS(base_2.x -B/12, base_2.y -A/4-rob_d/2+in_rf/2, base_2.z);
		makeDonutSection(Cpstrz_2BIS, vz, -vy, (in_rf/2)+(str_d/2), str_d, -90, _n, _n);

		FdPoint3d Cpstrz_3(base_2.x -B/4, base_2.y -A/4, base_2.z + str_d);
		makeDonutSection(Cpstrz_3, vz, -vy, (rob_d/2)+(str_d/2), str_d, -90, _n, _n);
		
		FdPoint3d Cpstrz_3BIS(base_2.x + B/12, base_2.y -A/4-rob_d/2+in_rf/2, base_2.z + str_d);
		makeDonutSection(Cpstrz_3BIS, vz, -vy, (in_rf/2)+(str_d/2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_4(base_2.x -B/4, base_2.y + A/4, base_2.z + str_d);
		makeDonutSection(Cpstrz_4, vz, vy, (rob_d/2)+(str_d/2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_4BIS(base_2.x + B/12, base_2.y + A/4+rob_d/2-in_rf/2, base_2.z + str_d);
		makeDonutSection(Cpstrz_4BIS, vz, vy, (in_rf/2)+(str_d/2), str_d, -90, _n, _n);

		FdPoint3d strz_tube_1(base_2.x -B/12, base_2.y + A/4+rob_d/2+str_d/2, base_2.z),
				  strz_tube_2(base_2.x + B/4, base_2.y + A/4+rob_d/2+str_d/2, base_2.z);
		FdPoint3d strz_t_1[2] = { strz_tube_1, strz_tube_2 };
		makeVerySimpleTube(strz_t_1, str_d, _n);

		FdPoint3d strz_tube_3(base_2.x - B / 12, base_2.y -A/4-rob_d/2-str_d/2, base_2.z),
				  strz_tube_4(base_2.x + B/4, base_2.y -A/4-rob_d/2-str_d/2, base_2.z);
		FdPoint3d strz_t_2[2] = { strz_tube_3, strz_tube_4 };
		makeVerySimpleTube(strz_t_2, str_d, _n);

		FdPoint3d strz_tube_5(base_2.x - B/12-in_rf/2-str_d/2, base_2.y + A/4+rob_d/2-in_rf/2, base_2.z),
				  strz_tube_6(base_2.x - B/12-in_rf/2-str_d/2, base_2.y -A/4-rob_d/2+in_rf/2, base_2.z);
		FdPoint3d strz_t_3[2] = { strz_tube_5, strz_tube_6 };
		makeVerySimpleTube(strz_t_3, str_d, _n); 

		FdPoint3d strz_tube_7(base_2.x + B/4+rob_d/2+str_d/2, base_2.y + A/4, base_2.z),
				  strz_tube_8(base_2.x + B/4+rob_d/2+str_d/2, base_2.y - A/4, base_2.z);
		FdPoint3d strz_t_4[2] = { strz_tube_7, strz_tube_8 };
		makeVerySimpleTube(strz_t_4, str_d, _n);

		FdPoint3d str_tube_9(base_2.x + B/12+str_d/2+in_rf/2, base_2.y + A/4+rob_d/2-in_rf/2, base_2.z + str_d),
				  str_tube_10(base_2.x + B/12+str_d/2+in_rf/2, base_2.y - A/4-rob_d/2+in_rf/2, base_2.z + str_d);
		FdPoint3d strz_t_5[2] = { str_tube_9, str_tube_10 };
		makeVerySimpleTube(strz_t_5, str_d, _n);

		FdPoint3d str_tube_11(base_2.x - B/4-rob_d/2-str_d/2, base_2.y + A/4, base_2.z + str_d),
				  str_tube_12(base_2.x -B/4-rob_d/2-str_d/2, base_2.y - A/4, base_2.z + str_d);
		FdPoint3d str_t_6[2] = { str_tube_11, str_tube_12 };
		makeVerySimpleTube(str_tube_11, str_tube_12, str_d, _n);

		FdPoint3d str_tube_13(base_2.x - B/4, base_2.y + A/4+rob_d/2+str_d/2, base_2.z + str_d),
				  str_tube_14(base_2.x + B/12, base_2.y + A/4+rob_d/2+str_d/2, base_2.z + str_d);
		FdPoint3d str_t_7[2] = { str_tube_13, str_tube_14 };
		makeVerySimpleTube(str_t_7, str_d, _n);

		FdPoint3d str_tube_15(base_2.x - B/4, base_2.y - A/4-rob_d/2-str_d/2, base_2.z + str_d),
				  str_tube_16(base_2.x + B/12, base_2.y - A/4-rob_d/2-str_d/2, base_2.z + str_d);
		FdPoint3d str_t_8[2] = { str_tube_15, str_tube_16 };
		makeVerySimpleTube(str_t_8, str_d, _n);

		return 0;
}
short SzymorBlockCreator::makestirrups_3(const FdPoint3d &base_3)
{
	ads_real A, B, rob_d, str_d, in_rf, rob_lvl;

	get_val("A", A);
	get_val("B", B);
	get_val("rob_d", rob_d);
	get_val("str_d", str_d);
	get_val("in_rf", in_rf);
	get_val("rob_lvl", rob_lvl);

		//float first_gap = 0.333 * str_gap;
		//float str_height = first_gap + str_d;
		//float str_num = floor( B / str_height);

	//const FdPoint3d &offs double diameter, bool opt
	
		FdPoint3d Cpstrz_1(base_3.x + B / 4, base_3.y + A / 4, base_3.z);
		makeDonutSection(Cpstrz_1, vz, vx, (rob_d / 2) + (str_d / 2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_1BIS(base_3.x - B / 12, base_3.y + A / 4 + rob_d / 2 - in_rf / 2, base_3.z);
		makeDonutSection(Cpstrz_1BIS, vz, vy, (in_rf/2)+(str_d/2), str_d, 90, _n, _n);

		FdPoint3d Cpstrz_2(base_3.x + B / 4, base_3.y - A / 4, base_3.z);
		makeDonutSection(Cpstrz_2, vz, -vy, (rob_d / 2) + (str_d / 2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_2BIS(base_3.x -B/12, base_3.y -A/4-rob_d/2+in_rf/2, base_3.z);
		makeDonutSection(Cpstrz_2BIS, vz, -vy, (in_rf/2)+(str_d/2), str_d, -90, _n, _n);

		FdPoint3d Cpstrz_3(base_3.x -B/4, base_3.y -A/4, base_3.z + str_d);
		makeDonutSection(Cpstrz_3, vz, -vy, (rob_d/2)+(str_d/2), str_d, -90, _n, _n);
		
		FdPoint3d Cpstrz_3BIS(base_3.x + B/12, base_3.y -A/4-rob_d/2+in_rf/2, base_3.z + str_d);
		makeDonutSection(Cpstrz_3BIS, vz, -vy, (in_rf/2)+(str_d/2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_4(base_3.x -B/4, base_3.y + A/4, base_3.z + str_d);
		makeDonutSection(Cpstrz_4, vz, vy, (rob_d/2)+(str_d/2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_4BIS(base_3.x + B/12, base_3.y + A/4+rob_d/2-in_rf/2, base_3.z + str_d);
		makeDonutSection(Cpstrz_4BIS, vz, vy, (in_rf/2)+(str_d/2), str_d, -90, _n, _n);

		FdPoint3d strz_tube_1(base_3.x -B/12, base_3.y + A/4+rob_d/2+str_d/2, base_3.z),
				  strz_tube_2(base_3.x + B/4, base_3.y + A/4+rob_d/2+str_d/2, base_3.z);
		FdPoint3d strz_t_1[2] = { strz_tube_1, strz_tube_2 };
		makeVerySimpleTube(strz_t_1, str_d, _n);

		FdPoint3d strz_tube_3(base_3.x - B / 12, base_3.y -A/4-rob_d/2-str_d/2, base_3.z),
				  strz_tube_4(base_3.x + B/4, base_3.y -A/4-rob_d/2-str_d/2, base_3.z);
		FdPoint3d strz_t_2[2] = { strz_tube_3, strz_tube_4 };
		makeVerySimpleTube(strz_t_2, str_d, _n);

		FdPoint3d strz_tube_5(base_3.x - B/12-in_rf/2-str_d/2, base_3.y + A/4+rob_d/2-in_rf/2, base_3.z),
			   	  strz_tube_6(base_3.x - B/12-in_rf/2-str_d/2, base_3.y -A/4-rob_d/2+in_rf/2, base_3.z);
		FdPoint3d strz_t_3[2] = { strz_tube_5, strz_tube_6 };
		makeVerySimpleTube(strz_t_3, str_d, _n); 

		FdPoint3d strz_tube_7(base_3.x + B/4+rob_d/2+str_d/2, base_3.y + A/4, base_3.z),
				  strz_tube_8(base_3.x + B/4+rob_d/2+str_d/2, base_3.y - A/4, base_3.z);
		FdPoint3d strz_t_4[2] = { strz_tube_7, strz_tube_8 };
		makeVerySimpleTube(strz_t_4, str_d, _n);

		FdPoint3d str_tube_9(base_3.x + B/12+str_d/2+in_rf/2, base_3.y + A/4+rob_d/2-in_rf/2, base_3.z + str_d),
				  str_tube_10(base_3.x + B/12+str_d/2+in_rf/2, base_3.y - A/4-rob_d/2+in_rf/2, base_3.z + str_d);
		FdPoint3d strz_t_5[2] = { str_tube_9, str_tube_10 };
		makeVerySimpleTube(strz_t_5, str_d, _n);

		FdPoint3d str_tube_11(base_3.x - B/4-rob_d/2-str_d/2, base_3.y + A/4, base_3.z + str_d),
				  str_tube_12(base_3.x -B/4-rob_d/2-str_d/2, base_3.y - A/4, base_3.z + str_d);
		FdPoint3d str_t_6[2] = { str_tube_11, str_tube_12 };
		makeVerySimpleTube(str_tube_11, str_tube_12, str_d, _n);

		FdPoint3d str_tube_13(base_3.x - B/4, base_3.y + A/4+rob_d/2+str_d/2, base_3.z + str_d),
				  str_tube_14(base_3.x + B/12, base_3.y + A/4+rob_d/2+str_d/2, base_3.z + str_d);
		FdPoint3d str_t_7[2] = { str_tube_13, str_tube_14 };
		makeVerySimpleTube(str_t_7, str_d, _n);

		FdPoint3d str_tube_15(base_3.x - B/4, base_3.y - A/4-rob_d/2-str_d/2, base_3.z + str_d),
				  str_tube_16(base_3.x + B/12, base_3.y - A/4-rob_d/2-str_d/2, base_3.z + str_d);
		FdPoint3d str_t_8[2] = { str_tube_15, str_tube_16 };
		makeVerySimpleTube(str_t_8, str_d, _n);

		return 0;
}
short SzymorBlockCreator::makestirrups_4(const FdPoint3d &base_4)
{
	ads_real A, B, rob_d, str_d, in_rf, rob_lvl;

	get_val("A", A);
	get_val("B", B);
	get_val("rob_d", rob_d);
	get_val("str_d", str_d);
	get_val("in_rf", in_rf);
	get_val("rob_lvl", rob_lvl);

		//float first_gap = 0.333 * str_gap;
		//float str_height = first_gap + str_d;
		//float str_num = floor( B / str_height);

	//const FdPoint3d &offs double diameter, bool opt
	
		FdPoint3d Cpstrz_1(base_4.x + B / 4, base_4.y + A / 4, base_4.z);
		makeDonutSection(Cpstrz_1, vz, vx, (rob_d / 2) + (str_d / 2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_1BIS(base_4.x - B / 12, base_4.y + A / 4 + rob_d / 2 - in_rf / 2, base_4.z);
		makeDonutSection(Cpstrz_1BIS, vz, vy, (in_rf/2)+(str_d/2), str_d, 90, _n, _n);

		FdPoint3d Cpstrz_2(base_4.x + B / 4, base_4.y - A / 4, base_4.z);
		makeDonutSection(Cpstrz_2, vz, -vy, (rob_d / 2) + (str_d / 2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_2BIS(base_4.x -B/12, base_4.y -A/4-rob_d/2+in_rf/2, base_4.z);
		makeDonutSection(Cpstrz_2BIS, vz, -vy, (in_rf/2)+(str_d/2), str_d, -90, _n, _n);

		FdPoint3d Cpstrz_3(base_4.x -B/4, base_4.y -A/4, base_4.z + str_d);
		makeDonutSection(Cpstrz_3, vz, -vy, (rob_d/2)+(str_d/2), str_d, -90, _n, _n);
		
		FdPoint3d Cpstrz_3BIS(base_4.x + B/12, base_4.y -A/4-rob_d/2+in_rf/2, base_4.z + str_d);
		makeDonutSection(Cpstrz_3BIS, vz, -vy, (in_rf/2)+(str_d/2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_4(base_4.x -B/4, base_4.y + A/4, base_4.z + str_d);
		makeDonutSection(Cpstrz_4, vz, vy, (rob_d/2)+(str_d/2), str_d, 90, _n, _n);
		
		FdPoint3d Cpstrz_4BIS(base_4.x + B/12, base_4.y + A/4+rob_d/2-in_rf/2, base_4.z + str_d);
		makeDonutSection(Cpstrz_4BIS, vz, vy, (in_rf/2)+(str_d/2), str_d, -90, _n, _n);

		FdPoint3d strz_tube_1(base_4.x -B/12, base_4.y + A/4+rob_d/2+str_d/2, base_4.z),
				  strz_tube_2(base_4.x + B/4, base_4.y + A/4+rob_d/2+str_d/2, base_4.z);
		FdPoint3d strz_t_1[2] = { strz_tube_1, strz_tube_2 };
		makeVerySimpleTube(strz_t_1, str_d, _n);

		FdPoint3d strz_tube_3(base_4.x - B / 12, base_4.y -A/4-rob_d/2-str_d/2, base_4.z),
				  strz_tube_4(base_4.x + B/4, base_4.y -A/4-rob_d/2-str_d/2, base_4.z);
		FdPoint3d strz_t_2[2] = { strz_tube_3, strz_tube_4 };
		makeVerySimpleTube(strz_t_2, str_d, _n);

		FdPoint3d strz_tube_5(base_4.x - B/12-in_rf/2-str_d/2, base_4.y + A/4+rob_d/2-in_rf/2, base_4.z),
			   	  strz_tube_6(base_4.x - B/12-in_rf/2-str_d/2, base_4.y -A/4-rob_d/2+in_rf/2, base_4.z);
		FdPoint3d strz_t_3[2] = { strz_tube_5, strz_tube_6 };
		makeVerySimpleTube(strz_t_3, str_d, _n); 

		FdPoint3d strz_tube_7(base_4.x + B/4+rob_d/2+str_d/2, base_4.y + A/4, base_4.z),
				  strz_tube_8(base_4.x + B/4+rob_d/2+str_d/2, base_4.y - A/4, base_4.z);
		FdPoint3d strz_t_4[2] = { strz_tube_7, strz_tube_8 };
		makeVerySimpleTube(strz_t_4, str_d, _n);

		FdPoint3d str_tube_9(base_4.x + B/12+str_d/2+in_rf/2, base_4.y + A/4+rob_d/2-in_rf/2, base_4.z + str_d),
				  str_tube_10(base_4.x + B/12+str_d/2+in_rf/2, base_4.y - A/4-rob_d/2+in_rf/2, base_4.z + str_d);
		FdPoint3d strz_t_5[2] = { str_tube_9, str_tube_10 };
		makeVerySimpleTube(strz_t_5, str_d, _n);

		FdPoint3d str_tube_11(base_4.x - B/4-rob_d/2-str_d/2, base_4.y + A/4, base_4.z + str_d),
				  str_tube_12(base_4.x -B/4-rob_d/2-str_d/2, base_4.y - A/4, base_4.z + str_d);
		FdPoint3d str_t_6[2] = { str_tube_11, str_tube_12 };
		makeVerySimpleTube(str_tube_11, str_tube_12, str_d, _n);

		FdPoint3d str_tube_13(base_4.x - B/4, base_4.y + A/4+rob_d/2+str_d/2, base_4.z + str_d),
				  str_tube_14(base_4.x + B/12, base_4.y + A/4+rob_d/2+str_d/2, base_4.z + str_d);
		FdPoint3d str_t_7[2] = { str_tube_13, str_tube_14 };
		makeVerySimpleTube(str_t_7, str_d, _n);

		FdPoint3d str_tube_15(base_4.x - B/4, base_4.y - A/4-rob_d/2-str_d/2, base_4.z + str_d),
				  str_tube_16(base_4.x + B/12, base_4.y - A/4-rob_d/2-str_d/2, base_4.z + str_d);
		FdPoint3d str_t_8[2] = { str_tube_15, str_tube_16 };
		makeVerySimpleTube(str_t_8, str_d, _n);

		return 0;
}

short SzymorBlockCreator::makeInRef()
{
	ads_real A, B, L, rob_d, in_rf, rob_lvl;

	get_val("A", A);
	get_val("B", B);
	get_val("L", L);
	get_val("rob_d", rob_d);
	get_val("in_rf", in_rf);
	get_val("rob_lvl", rob_lvl);

		FdPoint3d in_rf_1(B/12, A/4+rob_d/2-in_rf/2, 40),
				  in_rf_2(B/12, A/4+rob_d/2-in_rf/2, L-40);
		FdPoint3d CPin_rf_1[2] = { in_rf_1, in_rf_2 };
		makeVerySimpleTube(CPin_rf_1, in_rf, 4);

		FdPoint3d in_rf_3(-B/12, A/4+rob_d/2-in_rf/2, 40),
				  in_rf_4(-B/12, A/4+rob_d/2-in_rf/2, L-40);
		FdPoint3d CPin_rf_2[2] = { in_rf_3, in_rf_4 };
		makeVerySimpleTube(CPin_rf_2, in_rf, 4);

		FdPoint3d in_rf_5(B/12, -A/4-rob_d/2+in_rf/2, 40),
				  in_rf_6(B/12, -A/4-rob_d/2+in_rf/2, L-40);
		FdPoint3d CPin_rf_3[2] = { in_rf_5, in_rf_6 };
		makeVerySimpleTube(CPin_rf_3, in_rf, 4);

		FdPoint3d in_rf_7(-B/12, -A/4-rob_d/2+in_rf/2, 40),
				  in_rf_8(-B/12, -A/4-rob_d/2+in_rf/2, L-40);
		FdPoint3d CPin_rf_4[2] = { in_rf_7, in_rf_8 };
		makeVerySimpleTube(CPin_rf_4, in_rf, 4);

		return 0;
}

short SzymorBlockCreator::makeOutRef()
{
	ads_real A, B, L, rob_d, rob_lvl, RF, str_d;
	get_val("A", A);
	get_val("B", B);
	get_val("L", L);
	get_val("rob_d", rob_d);
	get_val("rob_lvl", rob_lvl);
	get_val("RF", RF);
	get_val("str_d", str_d);

		FdPoint3d rein1( (B/4)+(rob_d/2-RF*1.5), rob_d/2+RF/2, 40),
				  rein2( (B/4)+(rob_d/2-RF*1.5), rob_d/2+RF/2, L-40);
		FdPoint3d CPrein1[2] = { rein1, rein2 };
		makeVerySimpleTube(CPrein1, RF, 4);

		FdPoint3d rein3( (B/4)+(rob_d/2-RF/2), rob_d/2+RF/2, 40),
				  rein4( (B/4)+(rob_d/2-RF/2), rob_d/2+RF/2, rob_lvl),
				  rein5( (B/4)+(rob_d/2-RF/2), A/4+rob_d/2-RF/2, 390+rob_lvl),
				  rein6( (B/4)+(rob_d/2-RF/2), A/4+rob_d/2-RF/2, L-40);
		FdPoint3d CPrein2[4] = { rein3, rein4, rein5, rein6 };
		makeElbowedTube(CPrein2, RF, _n, 3, false);

		FdPoint3d rein7( -(B/4)-(rob_d/2-RF*1.5), rob_d/2+RF/2, 40),
				  rein8( -(B/4)-(rob_d/2-RF*1.5), rob_d/2+RF/2, L-40);
		FdPoint3d CPrein3[2] = { rein7, rein8 };
		makeVerySimpleTube(CPrein3, RF, 4);

		FdPoint3d rein9( -(B/4)-(rob_d/2-RF/2), rob_d/2+RF/2, 40),
				  rein10( -(B/4)-(rob_d/2-RF/2), rob_d/2+RF/2, rob_lvl),
				  rein11( -(B/4)-(rob_d/2-RF/2), A/4+rob_d/2-RF/2, 390+rob_lvl),
				  rein12( -(B/4)-(rob_d/2-RF/2), A/4+rob_d/2-RF/2, L-40);
		FdPoint3d CPrein4[4] = { rein9, rein10, rein11, rein12 };
		makeElbowedTube(CPrein4, RF, _n, 3, false);

		FdPoint3d rein13( (B/4)+(rob_d/2-RF*1.5), -rob_d/2-RF/2, 40),
				  rein14( (B/4)+(rob_d/2-RF*1.5), -rob_d/2-RF/2, L-40);
		FdPoint3d CPrein5[2] = { rein13, rein14 };
		makeVerySimpleTube(CPrein5, RF, 4);

		FdPoint3d rein15( (B/4)+(rob_d/2-RF/2), -rob_d/2-RF/2, 40),
				  rein16( (B/4)+(rob_d/2-RF/2), -rob_d/2-RF/2, rob_lvl),
				  rein17( (B/4)+(rob_d/2-RF/2), -A/4-rob_d/2+RF/2, 390+rob_lvl),
				  rein18( (B/4)+(rob_d/2-RF/2), -A/4-rob_d/2+RF/2, L-40);
		FdPoint3d CPrein6[4] = { rein15, rein16, rein17, rein18 };
		makeElbowedTube(CPrein6, RF, _n, 3, false);

		FdPoint3d rein19( -(B/4)-(rob_d/2-RF*1.5), -rob_d/2-RF/2, 40),
				  rein20( -(B/4)-(rob_d/2-RF*1.5), -rob_d/2-RF/2, L-40);
		FdPoint3d CPrein7[2] = { rein19, rein20 };
		makeVerySimpleTube(CPrein7, RF, 4);

		FdPoint3d rein21( -(B/4)-(rob_d/2-RF/2), -rob_d/2-RF/2, 40),
				  rein22( -(B/4)-(rob_d/2-RF/2), -rob_d/2-RF/2, rob_lvl),
				  rein23( -(B/4)-(rob_d/2-RF/2), -A/4-rob_d/2+RF/2, 390+rob_lvl),
				  rein24( -(B/4)-(rob_d/2-RF/2), -A/4-rob_d/2+RF/2, L-40);
		FdPoint3d CPrein8[4] = { rein21, rein22, rein23, rein24 };
		makeElbowedTube(CPrein8, RF, _n, 3, false);

		return 0;
}

short SzymorBlockCreator::makeSZYM_SLP()
{
	ads_real A, B, L, s_lvl, rob_d, rob_lvl, rob_num, RF, make_rf, str_d, in_rf, str_gap;
	get_val("A", A);
	get_val("B", B);
	get_val("L", L);
	get_val("s_lvl", s_lvl);
	get_val("rob_d", rob_d);
	get_val("rob_lvl", rob_lvl);
	get_val("rob_num", rob_num);
	get_val("RF", RF);
	get_val("make_rf", make_rf);
	get_val("str_d", str_d);
	get_val("in_rf", in_rf);
	get_val("str_gap", str_gap);

	FdPoint3d p1(0, 0, 0),
	          p2(0, 0, L);

	FdPoint3d cp[2] = { p1, p2 };
	double tabWidth[2] = { A, A };
	double tabHeight[2] = { B, B };
	bool sides[] = { true, true, true, true };
	bool connector[] = { false };

	makeBox(1, cp, tabWidth, tabHeight, sides, connector, true, true);
	
	if(rob_num == 2 && A <= B)
	{
		FdPoint3d rob_1(B/4, 0, 0),
				  rob_11(B/4, 0, rob_lvl),
				  rob_111(B/2, 0, rob_lvl);
		FdPoint3d rob_[3] = { rob_1, rob_11, rob_111 };
		makeElbowedTube(rob_, rob_d, _n, 2, false);

		FdPoint3d rob_2(-B/4, 0, 0),
			  rob_22(-B/4, 0, rob_lvl),
			  rob_222(-B/2, 0, rob_lvl);
		FdPoint3d rob__[3] = { rob_2, rob_22, rob_222 };
		makeElbowedTube(rob__, rob_d, _n, 2, false);
	}
	if(rob_num == 2 && A > B)
	{
		FdPoint3d rob_3(0, A/4, 0),
			  rob_33(0, A/4, rob_lvl),
			  rob_333(0, A/2, rob_lvl);
		FdPoint3d rob___[3] = { rob_3, rob_33, rob_333 };
		makeElbowedTube(rob___, rob_d, _n, 2, false);

		FdPoint3d rob_4(0, -A/4, 0),
			  rob_44(0, -A/4, rob_lvl),
			  rob_444(0, -A/2, rob_lvl);
		FdPoint3d rob____[3] = { rob_4, rob_44, rob_444 };
		makeElbowedTube(rob____, rob_d, _n, 2, false);
	}
	if (rob_num == 4 && A <= B)
	{
		FdPoint3d cr(B/4, A/4, 0),
			  cr1(B/4, A/4, rob_lvl),
			  cr2(B/2, A/4, rob_lvl);
		FdPoint3d crp[3] = { cr, cr1, cr2 };
		makeElbowedTube(crp, rob_d, _n, 2, false);

		FdPoint3d crr(-B/4, A/4, 0),
			  crr1(-B/4, A/4, rob_lvl),
			  crr2(-B/2, A/4, rob_lvl);
		FdPoint3d crp1[3] = { crr, crr1, crr2 };
		makeElbowedTube(crp1, rob_d, _n, 2, false);

		FdPoint3d crrr(-B/4, -A/4, 0),
			  crrr1(-B/4, -A/4, rob_lvl),
			  crrr2(-B/2, -A/4, rob_lvl);
		FdPoint3d crp2[3] = { crrr, crrr1, crrr2 };
		makeElbowedTube(crp2, rob_d, _n, 2, false);

		FdPoint3d crrrr(B/4, -A/4, 0),
			  crrrr1(B/4, -A/4, rob_lvl),
			  crrrr2(B/2, -A/4, rob_lvl);
		FdPoint3d crp3[3] = { crrrr, crrrr1, crrrr2 };
		makeElbowedTube(crp3, rob_d, _n, 2, false);

		if(make_rf == 1)
			{
				makeInRef();
				makeOutRef();
		
		float first_gap = 0.333 * str_gap;
		float str_height = first_gap + str_d;
		float str_num = floor(B / str_height);

		FdPoint3d base(0, 0, (65 + str_d / 2));

		for(int i = 0; i < str_num; i++)
		{
			makestirrups_1(base);
	
			base.x += 0;
			base.y += 0;
			base.z += str_height;
		}

		float second_gap = 0.5 * str_gap;
		float str_height_2 = second_gap + str_d;
		float str_num_2 = floor( ( rob_lvl - B ) / str_height_2);
		
		FdPoint3d base_2(0, 0, (B + second_gap));

		for(int i = 0; i < str_num_2; i++)
		{
			makestirrups_2(base_2);
	
			base_2.x += 0;
			base_2.y += 0;
			base_2.z += str_height_2;
		}

		float str_height_3 = str_gap + str_d;
		float str_num_3 = floor( ( L - ( rob_lvl + B ) ) / str_height_3);

		FdPoint3d base_3(0, 0, rob_lvl + str_gap);

		for(int i = 0; i < str_num_3; i++)
		{
			makestirrups_3(base_3);
			base_3.x += 0;
			base_3.y += 0;
			base_3.z += str_height_3;
		}

		float third_gap = 0.333 * str_gap;
		float str_height_4 = third_gap + str_d;
		float str_num_4 = floor( ( B - 40 ) / str_height);

		FdPoint3d base_4(0, 0, ( L - B ) + third_gap);

		for(int i = 0; i < str_num_4; i++)
		{
			makestirrups_4(base_4);
	
			base_4.x += 0;
			base_4.y += 0;
			base_4.z += str_height_4;
		}
			}
	}

	if(rob_num == 4 && A > B)
	{
		FdPoint3d CR(B/4, A/4, 0),
				  CR1(B/4, A/4, rob_lvl),
				  CR2(B/4, A/2, rob_lvl);
		FdPoint3d CRP[3] = { CR, CR1, CR2 };
		makeElbowedTube(CRP, rob_d, _n, 2, false);

		FdPoint3d CRR(-B/4, A/4, 0),
				  CRR1(-B/4, A/4, rob_lvl),
				  CRR2(-B/4, A/2, rob_lvl);
		FdPoint3d CRRP[3] = { CRR, CRR1, CRR2 };
		makeElbowedTube(CRRP, rob_d, _n, 2, false);

		FdPoint3d CRRR(B/4, -A/4, 0),
			  CRRR1(B/4, -A/4, rob_lvl),
			  CRRR2(B/4, -A/2, rob_lvl);
		FdPoint3d CRRRP[3] = { CRRR, CRRR1, CRRR2 };
		makeElbowedTube(CRRRP, rob_d, _n, 2, false);

		FdPoint3d CRRRR(-B/4, -A/4, 0),
				  CRRRR1(-B/4, -A/4, rob_lvl),
				  CRRRR2(-B/4, -A/2, rob_lvl);
		FdPoint3d CRRRRP[3] = { CRRRR, CRRRR1, CRRRR2 };
		makeElbowedTube(CRRRRP, rob_d, _n, 2, false);
	}
	if(rob_num == 5 && A <= B)
	{
		FdPoint3d R(B/4, A/4, 0),
				 R1(B/4, A/4, rob_lvl),
				 R2(B/2, A/4, rob_lvl);
		FdPoint3d CR[3] = { R, R1, R2 };
		makeElbowedTube(CR, rob_d, _n, 2, false);

		FdPoint3d RR(-B/4, A/4, 0),
				RR1(-B/4, A/4, rob_lvl),
				RR2(-B/2, A/4, rob_lvl);
		FdPoint3d CR1[3] = { RR, RR1, RR2 };
		makeElbowedTube(CR1, rob_d, _n, 2, false);

		FdPoint3d RRR(-B/4, -A/4, 0),
				  RRR1(-B/4, -A/4, rob_lvl),
				  RRR2(-B/2, -A/4, rob_lvl);
		FdPoint3d CR2[3] = { RRR, RRR1, RRR2 };
		makeElbowedTube(CR2, rob_d, _n, 2, false);

		FdPoint3d RRRR(B/4, -A/4, 0),
				  RRRR1(B/4, -A/4, rob_lvl),
				  RRRR2(B/2, -A/4, rob_lvl);
		FdPoint3d CR3[3] = { RRRR, RRRR1, RRRR2 };
		makeElbowedTube(CR3, rob_d, _n, 2, false);

		FdPoint3d RRRRR(B/4, 0, 0),
				  RRRRR1(B/4, 0, rob_lvl),
				  RRRRR2(B/2, 0, rob_lvl);
		FdPoint3d CR4[3] = { RRRRR, RRRRR1, RRRRR2 };
		makeElbowedTube(CR4, rob_d, _n, 2, false);

		if(make_rf == 1)
			{
				makeInRef();
				makeOutRef();

		float first_gap = 0.333 * str_gap;
		float str_height = first_gap + str_d;
		float str_num = floor(B / str_height);

		FdPoint3d base(0, 0, (65 + str_d / 2));

		for(int i = 0; i < str_num; i++)
		{
			makestirrups_1(base);
	
			base.x += 0;
			base.y += 0;
			base.z += str_height;
		}

		float second_gap = 0.5 * str_gap;
		float str_height_2 = second_gap + str_d;
		float str_num_2 = floor( ( rob_lvl - B ) / str_height_2);
		
		FdPoint3d base_2(0, 0, (B + second_gap));

		for(int i = 0; i < str_num_2; i++)
		{
			makestirrups_2(base_2);
	
			base_2.x += 0;
			base_2.y += 0;
			base_2.z += str_height_2;
		}

		float str_height_3 = str_gap + str_d;
		float str_num_3 = floor( ( L - ( rob_lvl + B ) ) / str_height_3);

		FdPoint3d base_3(0, 0, rob_lvl + str_gap);

		for(int i = 0; i < str_num_3; i++)
		{
			makestirrups_3(base_3);
			base_3.x += 0;
			base_3.y += 0;
			base_3.z += str_height_3;
		}

		float third_gap = 0.333 * str_gap;
		float str_height_4 = third_gap + str_d;
		float str_num_4 = floor( ( B - 40 ) / str_height);

		FdPoint3d base_4(0, 0, ( L - B ) + third_gap);

		for(int i = 0; i < str_num_4; i++)
		{
			makestirrups_4(base_4);
	
			base_4.x += 0;
			base_4.y += 0;
			base_4.z += str_height_4;
		}
			}
	}
	if(rob_num == 5 && A > B)
	{
		FdPoint3d rob(B/4, A/4, 0),
				  rob1(B/4, A/4, rob_lvl),
				  rob2(B/4, A/2, rob_lvl);
		FdPoint3d rob_[3] = { rob, rob1, rob2 };
		makeElbowedTube(rob_, rob_d, _n, 2, false);

		FdPoint3d rob3(-B/4, A/4, 0),
				  rob4(-B/4, A/4, rob_lvl),
				  rob5(-B/4, A/2, rob_lvl);
		FdPoint3d rob__[3] = { rob3, rob4, rob5 };
		makeElbowedTube(rob__, rob_d, _n, 2, false);

		FdPoint3d rob6(B/4, -A/4, 0),
			   	  rob7(B/4, -A/4, rob_lvl),
				  rob8(B/4, -A/2, rob_lvl);
		FdPoint3d rob___[3] = { rob6, rob7, rob8 };
		makeElbowedTube(rob___, rob_d, _n, 2, false);

		FdPoint3d rob9(-B/4, -A/4, 0),
				  rob10(-B/4, -A/4, rob_lvl),
				  rob11(-B/4, -A/2, rob_lvl);
		FdPoint3d rob____[3] = { rob9, rob10, rob11 };
		makeElbowedTube(rob____, rob_d, _n, 2, false);

		FdPoint3d rob12(0, -A/4, 0),
				  rob13(0, -A/4, rob_lvl),
				  rob14(0, -A/2, rob_lvl);
		FdPoint3d rob_____[3] = { rob12, rob13, rob14 };
		makeElbowedTube(rob_____, rob_d, _n, 2, false);
	}
	if(rob_num == 6 && A <= B)
	{
		FdPoint3d rob01(B/4, A/4, 0),
				 rob02(B/4, A/4, rob_lvl),
				 rob03(B/2, A/4, rob_lvl);
		FdPoint3d rob001[3] = { rob01, rob02, rob03 };
		makeElbowedTube(rob001, rob_d, _n, 2, false);

		FdPoint3d rob04(-B/4, A/4, 0),
				  rob05(-B/4, A/4, rob_lvl),
				  rob06(-B/2, A/4, rob_lvl);
		FdPoint3d rob002[3] = { rob04, rob05, rob06 };
		makeElbowedTube(rob002, rob_d, _n, 2, false);

		FdPoint3d rob07(-B/4, -A/4, 0),
				  rob08(-B/4, -A/4, rob_lvl),
				  rob09(-B/2, -A/4, rob_lvl);
		FdPoint3d rob003[3] = { rob07, rob08, rob09 };
		makeElbowedTube(rob003, rob_d, _n, 2, false);

		FdPoint3d rob010(B/4, -A/4, 0),
				  rob011(B/4, -A/4, rob_lvl),
				  rob012(B/2, -A/4, rob_lvl);
		FdPoint3d rob004[3] = { rob010, rob011, rob012 };
		makeElbowedTube(rob004, rob_d, _n, 2, false);

		FdPoint3d rob013(B/4, 0, 0),
				  rob014(B/4, 0, rob_lvl),
				  rob015(B/2, 0, rob_lvl);
		FdPoint3d rob005[3] = { rob013, rob014, rob015 };
		makeElbowedTube(rob005, rob_d, _n, 2, false);

		FdPoint3d rob016(-B/4, 0, 0),
				  rob017(-B/4, 0, rob_lvl),
				  rob018(-B/2, 0, rob_lvl);
		FdPoint3d rob006[3] = { rob016, rob017, rob018 };
		makeElbowedTube(rob006, rob_d, _n, 2, false);

		if(make_rf == 1)
		{
		makeInRef();
		makeOutRef();
		
		float first_gap = 0.333 * str_gap;
		float str_height = first_gap + str_d;
		float str_num = floor(B / str_height);

		FdPoint3d base(0, 0, (65 + str_d / 2));

		for(int i = 0; i < str_num; i++)
		{
			makestirrups_1(base);
	
			base.x += 0;
			base.y += 0;
			base.z += str_height;
		}

		float second_gap = 0.5 * str_gap;
		float str_height_2 = second_gap + str_d;
		float str_num_2 = floor( ( rob_lvl - B ) / str_height_2);
		
		FdPoint3d base_2(0, 0, (B + second_gap));

		for(int i = 0; i < str_num_2; i++)
		{
			makestirrups_2(base_2);
	
			base_2.x += 0;
			base_2.y += 0;
			base_2.z += str_height_2;
		}

		float str_height_3 = str_gap + str_d;
		float str_num_3 = floor( ( L - ( rob_lvl + B ) ) / str_height_3);

		FdPoint3d base_3(0, 0, rob_lvl + str_gap);

		for(int i = 0; i < str_num_3; i++)
		{
			makestirrups_3(base_3);
			base_3.x += 0;
			base_3.y += 0;
			base_3.z += str_height_3;
		}

		float third_gap = 0.333 * str_gap;
		float str_height_4 = third_gap + str_d;
		float str_num_4 = floor( ( B - 40 ) / str_height);

		FdPoint3d base_4(0, 0, ( L - B ) + third_gap);

		for(int i = 0; i < str_num_4; i++)
		{
			makestirrups_4(base_4);
	
			base_4.x += 0;
			base_4.y += 0;
			base_4.z += str_height_4;
		}
		}
	}
	if(rob_num == 6 && A > B)
	{
		FdPoint3d robu1(B/4, A/4, 0),
				  robu2(B/4, A/4, rob_lvl),
				  robu3(B/4, A/2, rob_lvl);
		FdPoint3d robu_[3] = { robu1, robu2, robu3 };
		makeElbowedTube(robu_, rob_d, _n, 2, false);

		FdPoint3d robu4(-B/4, A/4, 0),
				  robu5(-B/4, A/4, rob_lvl),
				  robu6(-B/4, A/2, rob_lvl);
		FdPoint3d robu__[3] = { robu4, robu5, robu6 };
		makeElbowedTube(robu__, rob_d, _n, 2, false);

		FdPoint3d robu7(B/4, -A/4, 0),
			      robu8(B/4, -A/4, rob_lvl),
				  robu9(B/4, -A/2, rob_lvl);
		FdPoint3d robu___[3] = { robu7, robu8, robu9 };
		makeElbowedTube(robu___, rob_d, _n, 2, false);

		FdPoint3d robu10(-B/4, -A/4, 0),
				  robu11(-B/4, -A/4, rob_lvl),
				  robu12(-B/4, -A/2, rob_lvl);
		FdPoint3d robu____[3] = { robu10, robu11, robu12 };
		makeElbowedTube(robu____, rob_d, _n, 2, false);

		FdPoint3d robu13(0, A/4, 0),
				  robu14(0, A/4, rob_lvl),
				  robu15(0, A/2, rob_lvl);
		FdPoint3d robu_____[3] = { robu13, robu14, robu15 };
		makeElbowedTube(robu_____, rob_d, _n, 2, false);

		FdPoint3d robu16(0, -A/4, 0),
				  robu17(0, -A/4, rob_lvl),
				  robu18(0, -A/2, rob_lvl);
		FdPoint3d robu______[3] = { robu16, robu17, robu18 };
		makeElbowedTube(robu______, rob_d, _n, 2, false);
	}

	/*FdPoint3d pc1(-B / 2, A / 4, s_lvl);
	FdPoint3d pc2(B / 2, A / 4, s_lvl);
	FdPoint3d pc3(-B / 2, -A / 4, s_lvl);
	FdPoint3d pc4(B / 2, -A / 4, s_lvl);

	FdPoint3d pc5(-B / 4, A / 2, s_lvl);
	FdPoint3d pc6(B / 4, A / 2, s_lvl);
	FdPoint3d pc7(-B / 4, -A / 2, s_lvl);
	FdPoint3d pc8(B / 4, -A / 2, s_lvl);

	makeSymbolicCircle(pc1, vx, 30);
	makeSymbolicCircle(pc2, vx, 30);
	makeSymbolicCircle(pc3, vx, 30);
	makeSymbolicCircle(pc4, vx, 30);
	makeSymbolicCircle(pc5, vy, 30);
	makeSymbolicCircle(pc6, vy, 30);
	makeSymbolicCircle(pc7, vy, 30);
	makeSymbolicCircle(pc8, vy, 30);

	FdPoint3d pr1(-B / 2, A / 4, rob_lvl);
	FdPoint3d pr2(B / 2, A / 4, rob_lvl);
	FdPoint3d pr3(-B / 2, -A / 4, rob_lvl);
	FdPoint3d pr4(B / 2, -A / 4, rob_lvl);

	FdPoint3d pr5(-B / 4, A / 2, rob_lvl);
	FdPoint3d pr6(B / 4, A / 2, rob_lvl);
	FdPoint3d pr7(-B / 4, -A / 2, rob_lvl);
	FdPoint3d pr8(B / 4, -A / 2, rob_lvl);

	makeSymbolicCircle(pr1, vx, rob_d);
	makeSymbolicCircle(pr2, vx, rob_d);
	makeSymbolicCircle(pr3, vx, rob_d);
	makeSymbolicCircle(pr4, vx, rob_d);
	makeSymbolicCircle(pr5, vy, rob_d);
	makeSymbolicCircle(pr6, vy, rob_d);
	makeSymbolicCircle(pr7, vy, rob_d);
	makeSymbolicCircle(pr8, vy, rob_d); */

	return 0;
}
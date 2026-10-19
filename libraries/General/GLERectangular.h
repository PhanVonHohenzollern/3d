#ifndef __GLE_RECTANGULAR_H__
#define __GLE_RECTANGULAR_H__


	// General Rectangular Elements
	void makeBA(double alfa, double a, double b, double d, double e, double f, double r, double n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeBO(double a, double b, double flange_1 = CONNECTOR_SIZE_N);
	void makeBS(double alfa, double a, double b, double e, double f, double r, double n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeCR1(double a, double b, double g, double h, double l, double e, double f, double l3, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N, double flange_4 = CONNECTOR_SIZE_N);
	void makeCR2(double height, double width, double diam1, double length1, double length2, double e, double f, int n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeCR5(double a, double b, double d, double h, double j, double e, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N, double flange_4 = CONNECTOR_SIZE_N);
	void makeEA(double a, double b, double d, double e, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeES(double a, double b, double e, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeHS(double a, double b, double d, double h, double e, double m, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N);
	void makeK(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeRA(double height, double width, double diam1, double length1, double length2, double e, double f, double flange1, double flange2, int n, double flange_1 = CONNECTOR_SIZE_N);
	void makeTA(double a, double b, double d, double h, double e, double f, double r, double m, double l, double n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N);
	void makeTG(double a, double b, double d, double h, double e, double f, double r, double l, double n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N);
	void makeTR1(double a, double b, double g, double h, double l, double e, double f, double l3, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N);
	void makeTR1a(double a, double b, double d, double g, double h, double l, double e, double f, double l3, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N);
	void makeTR2a(double height, double width1, double width2, double diam1, double length1, double length2, double e, double f, int n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeTR3(double a, double b, double d, double h, double r, double n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N);
	void makeTR4(double a, double b, double d, double h, double r, double l, double alfa, double n);
	void makeTR6(double a, double b, double d, double g, double h, double e, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N);
	void makeTR7(double a, double b, double d, double g, double r, double l, double n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N);
	void makeTR8(double a, double b, double d, double g, double r, double l, double n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N);
	void makeTR9(double a, double b, double d, double g, double r, double l, double n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N, double flange_3 = CONNECTOR_SIZE_N);
	void makeUA(double a, double b, double c, double d, double l, double e, double f, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeWA(double alfa, double a, double b, double d, double e, double f, double r, double n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeWS(double alfa, double a, double b, double e, double f, double r, double n, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);

#endif

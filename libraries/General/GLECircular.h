#ifndef __GLE_CIRCULAR_H__
#define __GLE_CIRCULAR_H__

	// General Circular Elements
	void makeAP1(double diam1, double length1, double size, int n);
	void makeARE(double length1, double length2, double length3, double length4, double diam1, double diam2, double diam3, int n[2], double l3);
	void makeATE(double length1, double length2, double length3, double diam1, double diam2, int n[2]);
	void makeAYE(double length1, double length2, double length3, double diam1, double diam2, double angle, int n);
	void makeBGE(double diam1, double ratio, double angle, int n, int segmentation);
	void makeBSE(double diam1, double ratio, double angle, int n, int segmentation);
	void makeCP1(double length1, double length2, double length3, double diam1, double diam2, int n);
	void makeDFA(double diam1, double length1, double size, int n);
	void makeDRE(double diam1, double length1, double size, int n);
	void makeHSE(double diam1, double diam2, double length1, double angle, int n);
	void makeKXE(double length1, double length2, double length3, double diam1, double diam2, int n);
	void makeMFA(double diam1, double length1, int n);
	void makeOC1(double diam1, double length1, double length2, double e, int n);
	void makeSTE(double diam1, double diam2, double length1, int n);
	void makeTC1(double diam1, double length1, double height, double width, double e, int n, double flange_1 = CONNECTOR_SIZE_N);
	void makeTC2(double diam1, double diam2, double diam3, double length1, double length2, int n);
	void makeTC3(double diam1, double diam2, double length1, double length2, double length3, int n);
	void makeTUBE(double diam1, double length1, int n);
	void makeUAE(double diam1, double diam2, double length1, int n);
	void makeUSE(double diam1, double diam2, double length1, int n);
	void makeTRI45_90(double diam1, double diam2,  double diam3, double alfa, double l1, double l2, double l3);

	// new for ALNOR ASV-45 (TK-161228)
	void makeASV(double d1, double l1, double l2, int n);
	// new for ALNOR COLL (TK-170110)
	void makeCOLL(double d, double d1, double h, double h1, int n);
	void makeXSVL(double l1, double l2, double d1, double d3, double angle, int n);
	void makeBPBKC(double d1, double d3, double alfa, double r, double l, int n);
	void makeILSV45(double d1, double d2, double alfa, double lm, double l, double l2, int n);

#endif
